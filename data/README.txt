LedgerLens AI - Synthetic Test Dataset

Upload these four files in the LedgerLens UI:
1. purchase_orders.csv -> Purchase Orders
2. invoices.csv -> Invoices
3. payments.csv -> Payments
4. receipts.csv -> Receipts

expected_results.csv is the ground-truth file. DO NOT upload it as a production input.
Use it only to compare your system's final output against known expected statuses.

company_policy.json is optional for a future policy-aware module.

Dataset:
- 50 base purchase orders
- 51 invoice records (includes 1 duplicate)
- 46 payment records (includes missing payments and one amount mismatch)
- 48 receipt records (includes missing receipts)
- Controlled anomalies: vendor aliases, invoice ID formatting, amount differences,
  date differences, missing PO, duplicate invoice, missing payments, payment mismatch,
  and missing receipts.
