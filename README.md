# inventory-source-items

This is a simple Node.js proxy server that forwards specific requests to the
Magento REST API. It handles inventory quantity updates made by Ongoing WMS
integration and prevents unwanted updates.

It ignores updates that would decrease the quantity for source items (before
the order is shipped), because Magento already makes reservations for pending
orders.

REST endpoints handled:

- GET /rest/V1/inventory/source-items
- POST /rest/V1/inventory/source-items

See [Magento
docs](https://devdocs.magento.com/guides/v2.3/rest/modules/inventory/manage-source-items.html)
for details.
