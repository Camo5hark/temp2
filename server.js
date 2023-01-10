const https = require("https")
const fs = require("fs")
const {URL} = require("url")
const crypto = require("crypto")

function hasAccess(req, res) {
    if (req.headers.cookie) {
        const cookies = req.headers.cookie.split(",")

        if (cookies.length > 0) {
            for (var i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].split("=")

                return cookie.length >= 2 && cookie[0] == "token" && crypto.createHash("sha1").update(cookie[1]).digest("hex") == fs.readFileSync("token.sha1").toString()
            }
        }
    }

    return false
}

function getIndex(url) {
    if (url.searchParams.has("index")) {
        const index = Number(url.searchParams.get("index"))
        const files = fs.readdirSync("media")

        if (!Number.isNaN(index) && Number.isInteger(index) && index >= 0 && index < files.length) {
            return index
        }
    }

    return NaN
}

https.createServer({
    key: fs.readFileSync("https/key.pem"),
    cert: fs.readFileSync("https/cert.pem")
}, (req, res) => {
    console.log(`${req.socket.remoteAddress}:${req.socket.remotePort} ${req.url}`)

    const url = new URL(req.url, `https://${req.headers.host}`)

    switch (url.pathname) {
        default:
            res.writeHead(404, {"Content-Type": "text/plain"}).end("Resource not found")

            break
        case "/":
            if (hasAccess(req, res)) {
                res.writeHead(301, {"Location": "/stream"}).end()

                break
            }

            res.writeHead(301, {"Location": "/login"}).end()

            break
        case "/login":
            if (hasAccess(req, res)) {
                res.writeHead(301, {"Location": "/stream"}).end()

                break
            }

            res.writeHead(200, {"Content-Type": "text/html"}).end(fs.readFileSync("html/login.html"))

            break
        case "/stream":
            if (hasAccess(req, res)) {
                res.writeHead(200, {"Content-Type": "text/html"}).end(fs.readFileSync("html/stream.html"))

                break
            }

            res.writeHead(301, {"Location": "/login"}).end()

            break
        case "/splash":
            if (hasAccess(req, res)) {
                res.writeHead(200, {"Content-Type": "image/jpeg"}).end(fs.readFileSync("splash.jpg"))

                break
            }

            res.writeHead(401, {"Content-Type": "text/plain"}).end("Unauthorized")

            break
        case "/video":
            if (hasAccess(req, res)) {
                const index = getIndex(url)

                if (!Number.isNaN(index) && req.headers.range && req.headers.range.startsWith("bytes")) {
                    const range = req.headers.range.match(/[0-9]+/g)
                    const start = Math.max(Number(range[0]), 0)
                    const path = `media/${fs.readdirSync("media")[index]}`
                    const size = fs.statSync(path).size
                    const end = Math.min(range.length >= 2 ? Number(range[1]) : start + 1000000, size - 1)
                    const length = end - start + 1

                    res.writeHead(206, {
                        "Content-Type": "video/mp4",
                        "Content-Length": length,
                        "Content-Range": `bytes ${start}-${end}/${size}`,
                        "Accept-Ranges": "bytes"
                    })

                    fs.createReadStream(path, {
                        start: start,
                        end: end
                    }).pipe(res)

                    break
                }

                res.writeHead(400, {"Content-Type": "text/plain"}).end("Bad request")

                break
            }

            break
    }
}).listen(8080)