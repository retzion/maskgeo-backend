if (process.env.NODE_ENV !== "production") require("dotenv").config()

const cors = require("cors")
const express = require("express")
const bodyParser = require("body-parser")
const cookieParser = require("cookie-parser")
const gm = require("gm")
const request = require("request")

const { version: apiVersion } = require("./package.json")
const { appEnvironment: environment } = require("./config")
const api = require("./src/api")
const { authenticateToken } = require("./src/auth")
const { ObjectID } = require("./src/mongo")

const app = express()
const port = process.env.PORT || 3000

// custom error logging to db
const consoleError = console.error
console.error = function (err, req) {
  const appVersion = req && req.headers ? req.headers["x-app-version"] : null
  let error =
    typeof err === "object"
      ? {
          message: err.message,
          stack: err.stack,
        }
      : {
          message: err,
        }

  consoleError(err)
  api.logError({
    error,
    environment,
    appVersion,
    timestamp: new Date(),
    apiVersion,
    backend: true,
  })
}

// middleware
const checkApiKey = (req, res, next) => {
  /** Check the key against valid api keys */
  const { ["api-key"]: apiKey } = req.headers
  const validApiKeys = process.env["VALID_API_KEYS"]
    .split(",")
    .map(k => k.trim())
  if (!validApiKeys.includes(apiKey))
    return apiError('HTTP header "API-KEY" was not found.', res)

  const secure = false //req.headers.origin && req.headers.origin.includes("https://")
  const accessControlRequestHeaders = secure
    ? ["Access-Control-Request-Headers", "*; SameSite=None; Secure"]
    : ["Access-Control-Request-Headers", "*; SameSite=Lax"]

  // set some response headers
  res.header(...accessControlRequestHeaders)
  res.header("Access-Control-Allow-Headers", "*")
  res.header("Access-Control-Allow-Origin", req.headers.origin)
  // res.header("Referrer-Policy", "origin-when-cross-origin")
  res.header("Access-Control-Allow-Credentials", "true")
  res.header(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS, POST, HEAD, PUT, DELETE"
  )
  res.header("X-API-Version", apiVersion)

  next()
}
app.use(express.json())
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://maskgeo.herokuapp.com",
      "https://staging-maskgeo.herokuapp.com",
      "https://maskforecast.com",
      "https://www.maskforecast.com",
    ],
    credentials: true,
    // exposedHeaders: 'Authorization',
  })
)
app.use(cookieParser())
app.use(bodyParser.json({ limit: "150mb", extended: true }))
app.use(bodyParser.urlencoded({ limit: "150mb", extended: true }))

// error handling
apiError = (err, res) => {
  res.status(500)
  res.send({ error: err.message || err })
}

/**
 * @section Routes / Endpoints
 */

// root
app.get("/", (req, res) => {
  res.send(req.query)
})

// test db connection
app.get(
  "/test/:param1/:param2",
  [checkApiKey, authenticateToken],
  async (req, res) => {
    try {
      await api.testConnection()
      res.send({ params: req.params, query: req.query })
    } catch (err) {
      return apiError(err, res)
    }
  }
)

// log client error
app.post("/error", (req, res) => {
  api.logError({
    ...req.body,
    apiVersion,
    environment,
    timestamp: new Date(),
    frontend: true,
  })
  res.sendStatus(200)
})

// create user and get a magic link in an email
app.post("/user", api.createUser)

// get a jwt from a magic link
app.get("/jwt/:token", api.getTokenFromMagicLink)

// verify a jwt
app.head("/jwt", [checkApiKey, authenticateToken], api.verifyToken)

// get data from a jwt
app.get("/data", [checkApiKey, authenticateToken], async (req, res) => {
  if (req.jwtData) {
    // log user agent used by authenticated user
    api.updateUser({
      query: { _id: ObjectID(req.jwtData.user._id) },
      updates: {
        userAgent: req.headers["user-agent"],
        lastSession: new Date(),
      },
    })
  }
  res.send(req.jwtData)
})

// remove refresh jwt
app.delete("/jwt", [checkApiKey, authenticateToken], api.removeToken)

// request a magic link to log in
app.get("/login/:email", api.requestMagicLoginLink)

// post a rating and review
app.post("/review", [checkApiKey, authenticateToken], api.upsertReview)

// get ratings and reviews for a location
app.get("/reviews", api.fetchReviews)

// watermark a referenced google image
app.get("/gi/:photoReference", function (req, res) {
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${req.params.photoReference}&key=${process.env["GOOGLE_PLACES_API_KEY"]}`
  res.set("Content-Type", "image/png")
  convertImage(request.get(url)).pipe(res)
})

// watermark an image of a specified url
app.get("/wm/:url", function (req, res) {
  const url = decodeURIComponent(req.params.url)
  res.set("Content-Type", "image/png")
  convertImage(request.get(url)).pipe(res)
})

// init
app.listen(port, () => console.log(`v${apiVersion} running on port ${port}!`))

/** Helpers */
function convertImage(inputStream) {
  return gm(inputStream)
    .resize(600, 336)
    .composite("src/watermark.png")
    .geometry("+60+60")
    .stream()
}
