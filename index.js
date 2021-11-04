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

app.get('/rest/V1/inventory/source-items', function (req, res) {
    http.get({
        port: 8080,
        path: '/index.php' + req.url,
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

            const isNotRemoveQuantity = (item) => !(
                typeof item.quantity === 'number' &&
                _.some(itemsBySku[item.sku], cachedItem =>
                    cachedItem.source_code === item.source_code &&
                    cachedItem.quantity > item.quantity
                )
            )
            req.body.sourceItems = sourceItems.filter(isNotRemoveQuantity);

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
