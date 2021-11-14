const express = require('express')
const http = require('http')
const _ = require('lodash')
const app = express()
const port = 3000

app.set('query parser', false)

app.use(express.json()) // for parsing application/json

let inventoryItems = null

function addInventoryItems (data) {
    if (data && data.total_count > 0) {
        if (inventoryItems == null) {
            inventoryItems = data.items
        } else {
            inventoryItems = inventoryItems.concat(data.items)
        }
    }
}

// Matches space encoded as plus and latin1 chars (å, ä, ö)
const doubleEncoded = /%2B|(%25[0-9a-f]{2}){2}/g

const decodeSku = sku => sku.replace(doubleEncoded, decodeURIComponent)

const skuQuery = /\[field\]=sku&searchCriteria[^=]*\[value\]=([^&]*)/

const skuReplacer = (m, value) => m.replace(
    '[value]=' + value,
    '[value]=' + value.split('%2C').map(decodeSku).join()
)

app.get('/rest/V1/inventory/source-items', function (req, res) {
    http.get({
        port: 8080,
        path: '/index.php' + req.url.replace(skuQuery, skuReplacer),
        headers: _.pick(req.headers, 'accept', 'authorization')
    }, function (response) {
        res.set(response.headers)
        res.status(response.statusCode)
        if (response.statusCode === 200) {
            response.setEncoding('utf8')
            const chunks = []
            response.on('data', function (chunk) {
                chunks.push(chunk)
                res.write(chunk)
            })
            response.on('end', function () {
                if (response.complete) {
                    const parsedData = JSON.parse(chunks.join(''))
                    addInventoryItems(parsedData)
                }
                res.end()
            })
        } else {
            response.pipe(res)
        }
    })
})

app.post('/rest/V1/inventory/source-items', function (req, res) {
    let postData;

    if (req.body != null) {
        const sourceItems = req.body.sourceItems
        if (_.isArray(sourceItems) && inventoryItems != null) {
            const itemsBySku = _.groupBy(inventoryItems, 'sku')
            inventoryItems = null

            req.body.sourceItems = sourceItems.filter(function (item) {
                if (typeof item.quantity === 'number') {
                    const { sku, source_code } = item
                    const cachedItem = _.find(itemsBySku[sku], { source_code })

                    if (cachedItem && cachedItem.quantity >= item.quantity) {
                        item.quantity = cachedItem.quantity
                        return item.status === 0
                    }
                }
                return true
            })

            if (req.body.sourceItems.length === 0) {
                res.json([])
                return
            }
        }
        postData = JSON.stringify(req.body);
    }

    const request = http.request({
        port: 8080,
        path: '/index.php' + req.url,
        method: 'POST',
        headers: _.pick(req.headers, 'accept', 'authorization', 'content-type')
    }, function (response) {
        res.set(response.headers)
        res.status(response.statusCode)
        response.pipe(res)
    })
    request.end(postData);
})

const API_TOKEN = process.env.API_TOKEN

app.get('/rest/V1/inventory/get-product-salable-quantity/:sku/:stockId', function (req, res) {
    const headers = _.pick(req.headers, 'accept', 'authorization')

    if (!headers.authorization && API_TOKEN) {
        headers.authorization = 'Bearer ' + API_TOKEN
    }

    http.get({
        port: 8080,
        path: '/index.php' + req.url,
        headers
    }, function (response) {
        res.set(response.headers)
        res.status(response.statusCode)
        response.pipe(res)
    })
})

const server = app.listen(port)

process.on('SIGINT', function () {
    server.close(function (err) {
        if (err) {
            console.error(err)
            process.exit(1)
        } else {
            process.exit(0)
        }
    })
})
