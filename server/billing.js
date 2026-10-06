import crypto from "crypto";
import { isDatabaseConfigured, query } from "./db.js";
import { readStore, updateStore } from "./localStore.js";
import { addCredits } from "./credits.js";
import { updateApiKeyPlan } from "./apiKeys.js";
import { getPlan } from "./plans.js";

function mapOrder(row) {
  if (!row) return null;
  return {
    id: row.id, apiKeyId: row.api_key_id ?? row.apiKeyId, planId: row.plan_id ?? row.planId,
    currency: row.currency, amount: Number(row.amount), status: row.status,
    createdAt: row.created_at ?? row.createdAt, updatedAt: row.updated_at ?? row.updatedAt
  };
}
function mapPayment(row) {
  if (!row) return null;
  return {
    id: row.id, orderId: row.order_id ?? row.orderId, provider: row.provider,
    providerReference: row.provider_reference ?? row.providerReference,
    notificationToken: row.notification_token ?? row.notificationToken,
    checkoutUrl: row.checkout_url ?? row.checkoutUrl, status: row.status,
    createdAt: row.created_at ?? row.createdAt, updatedAt: row.updated_at ?? row.updatedAt
  };
}
function localOrder(o) { return mapOrder(o); }
function localPayment(p) { return mapPayment(p); }

export async function createOrder(apiKeyId, planId, currency, amount) {
  const now = new Date().toISOString(), id = crypto.randomUUID();
  if (isDatabaseConfigured()) {
    const result = await query(`INSERT INTO billing_orders
      (id, api_key_id, plan_id, currency, amount, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,'pending',$6,$6) RETURNING *`,
      [id,apiKeyId,planId,currency,amount,now]);
    return mapOrder(result.rows[0]);
  }
  const order={id,apiKeyId,planId,currency,amount,status:"pending",createdAt:now,updatedAt:now};
  await updateStore(s=>({...s,billingOrders:[...s.billingOrders,order]}));
  return localOrder(order);
}

export async function getOrder(apiKeyId, orderId) {
  if (isDatabaseConfigured()) {
    const r=await query(`SELECT * FROM billing_orders WHERE id=$1 AND api_key_id=$2 LIMIT 1`,[orderId,apiKeyId]);
    return mapOrder(r.rows[0]);
  }
  const s=await readStore();
  return localOrder(s.billingOrders.find(o=>o.id===orderId&&o.apiKeyId===apiKeyId));
}

export async function listOrders(apiKeyId) {
  if (isDatabaseConfigured()) {
    const r=await query(`SELECT * FROM billing_orders WHERE api_key_id=$1 ORDER BY created_at DESC`,[apiKeyId]);
    return r.rows.map(mapOrder);
  }
  const s=await readStore();
  return s.billingOrders.filter(o=>o.apiKeyId===apiKeyId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).map(localOrder);
}

export async function createPayment(orderId, provider, providerReference=null) {
  const now=new Date().toISOString(), id=crypto.randomUUID();
  if (isDatabaseConfigured()) {
    const r=await query(`INSERT INTO billing_payments
      (id,order_id,provider,provider_reference,status,created_at,updated_at)
      VALUES ($1,$2,$3,$4,'pending',$5,$5) RETURNING *`,
      [id,orderId,provider,providerReference,now]);
    return mapPayment(r.rows[0]);
  }
  const payment={id,orderId,provider,providerReference,notificationToken:null,checkoutUrl:null,status:"pending",createdAt:now,updatedAt:now};
  await updateStore(s=>({...s,billingPayments:[...s.billingPayments,payment]}));
  return localPayment(payment);
}

export async function getPayment(paymentId) {
  if (isDatabaseConfigured()) {
    const r=await query(`SELECT * FROM billing_payments WHERE id=$1 LIMIT 1`,[paymentId]);
    return mapPayment(r.rows[0]);
  }
  const s=await readStore();
  return localPayment(s.billingPayments.find(p=>p.id===paymentId));
}

export async function updatePayment(paymentId, fields) {
  if (isDatabaseConfigured()) {
    const allowed={providerReference:"provider_reference",notificationToken:"notification_token",checkoutUrl:"checkout_url",status:"status"};
    const updates=[],values=[]; let i=1;
    for(const [key,column] of Object.entries(allowed)) if(Object.prototype.hasOwnProperty.call(fields,key)){updates.push(`${column}=$${i++}`);values.push(fields[key]);}
    if(!updates.length)return getPayment(paymentId);
    values.push(new Date(),paymentId);
    const r=await query(`UPDATE billing_payments SET ${updates.join(", ")},updated_at=$${i++} WHERE id=$${i} RETURNING *`,values);
    return mapPayment(r.rows[0]);
  }
  const now=new Date().toISOString();
  let updated=null;
  await updateStore(s=>{const payments=s.billingPayments.map(p=>{if(p.id!==paymentId)return p;updated={...p,...Object.fromEntries(["providerReference","notificationToken","checkoutUrl","status"].filter(k=>Object.hasOwn(fields,k)).map(k=>[k,fields[k]])),updatedAt:now};return updated;});return {...s,billingPayments:payments};});
  return localPayment(updated);
}

export async function updateOrder(orderId, fields) {
  if (isDatabaseConfigured()) {
    const allowed={planId:"plan_id",currency:"currency",amount:"amount",status:"status"};
    const updates=[],values=[];let i=1;
    for(const [key,column] of Object.entries(allowed))if(Object.hasOwn(fields,key)){updates.push(`${column}=$${i++}`);values.push(fields[key]);}
    if(!updates.length)return null;
    values.push(new Date(),orderId);
    const r=await query(`UPDATE billing_orders SET ${updates.join(", ")},updated_at=$${i++} WHERE id=$${i} RETURNING *`,values);
    return mapOrder(r.rows[0]);
  }
  const now=new Date().toISOString();let updated=null;
  await updateStore(s=>({...s,billingOrders:s.billingOrders.map(o=>{if(o.id!==orderId)return o;updated={...o,...fields,updatedAt:now};return updated;})}));
  return localOrder(updated);
}

export function listProviders(){return[
  {id:"papi",name:"PAPI",type:"local",currency:["MGA"],status:"available"},
  {id:"international",name:"International Gateway",type:"international",currency:["USD","EUR"],status:"available"}
];}

export async function fulfillPaidPayment(paymentId,providerReference=null){
  const payment=await getPayment(paymentId);
  if(!payment)return{success:false,error:"Payment not found"};
  const order=await getOrderById(payment.orderId);
  if(!order)return{success:false,error:"Order not found"};
  if(payment.status==="paid"||order.status==="paid")return{success:true,alreadyFulfilled:true,payment,order};
  const plan=getPlan(order.planId);
  if(!plan||!Number.isInteger(plan.credits)||plan.credits<=0)return{success:false,error:"Invalid plan credits"};
  const updatedPayment=await updatePayment(paymentId,{status:"paid",...(providerReference?{providerReference}: {})});
  if(!updatedPayment||updatedPayment.status!=="paid")return{success:false,error:"Payment could not be fulfilled"};
  const updatedOrder=await updateOrder(order.id,{status:"paid"});
  const balance=await addCredits(order.apiKeyId,plan.credits,`payment_${payment.provider}`);
  const updatedKey=await updateApiKeyPlan(order.apiKeyId,plan.id);
  return{success:true,alreadyFulfilled:false,payment:updatedPayment,order:updatedOrder,plan:plan.id,
    planUpdated:Boolean(updatedKey)||order.apiKeyId==="core-bootstrap-key",creditsAdded:plan.credits,balance};
}

async function getOrderById(orderId){
  if(isDatabaseConfigured()){
    const r=await query(`SELECT * FROM billing_orders WHERE id=$1 LIMIT 1`,[orderId]);
    return mapOrder(r.rows[0]);
  }
  const s=await readStore();
  return localOrder(s.billingOrders.find(o=>o.id===orderId));
}
