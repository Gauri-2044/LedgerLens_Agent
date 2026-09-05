from fastapi import APIRouter, File, UploadFile

from app.controllers.process_uploads import (
    handle_invoices,
    handle_payments,
    handle_purchase_orders,
    handle_receipts,
)

uploads_route = APIRouter(prefix="/upload", tags=["uploads"])


@uploads_route.post("/purchase-orders")
async def process_purchase_order(file: UploadFile = File(...)):
    return await handle_purchase_orders(file)


@uploads_route.post("/invoices")
async def process_invoices(file: UploadFile = File(...)):
    return await handle_invoices(file)


@uploads_route.post("/payments")
async def process_payments(file: UploadFile = File(...)):
    return await handle_payments(file)


@uploads_route.post("/receipts")
async def process_receipts(file: UploadFile = File(...)):
    return await handle_receipts(file)