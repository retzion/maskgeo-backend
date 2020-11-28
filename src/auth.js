const jwt = require("jsonwebtoken")

const { version: apiVersion } = require("../package.json")
const { mongoConnect, ObjectID } = require("./mongo")

// config
const accessMinuteLifespan = 60 * 72
const refreshDayLifespan = 9
const tokenLifespan = {
  access: {
    milliseconds: accessMinuteLifespan * 60 * 1000,
    unitMeasurement: `${accessMinuteLifespan}m`,
  },
  refresh: {
    milliseconds: refreshDayLifespan * 24 * 60 * 60 * 1000,
    unitMeasurement: `${refreshDayLifespan}d`,
  },
}
const jwTokenCookieName = "mg-jwt"
const jwRefreshTokenCookieName = "mg-refresh-jwt"

/** @todo Store encrypted refresh tokens in the db */
// storage
let refreshTokens = new Array()

function storeRefreshToken(refreshToken) {
  refreshTokens.push(refreshToken)
}

function removeRefreshToken(refreshToken) {
  refreshTokens = refreshTokens.filter(token => token !== refreshToken)
}

// middleware function for authorization
async function authenticateToken(req, res, next) {
  const failedError = {
    apiVersion,
    status: 403,
    error: "Authentication failed.",
  }

  const {
    cookies: {
      [jwTokenCookieName]: accessToken,
      [jwRefreshTokenCookieName]: refreshToken,
    },
    headers: { authorization = "" },
  } = req
  auth = accessToken || authorization.split(" ")[1]
  req.jwtData = { apiVersion }

  if (req.method === "DELETE") {
    res = setJwtCookie(res, jwTokenCookieName, "", new Date(), true)
    res = setJwtCookie(res, jwRefreshTokenCookieName, "", new Date(), true)
  }

  if (!auth && !refreshToken) return res.send(failedError)

  jwt.verify(auth, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      // the access token cannot be verified so we validate the refresh token
      jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        (err, refreshTokenUser) => {
          if (err) return res.send(failedError)
          req.jwtData = {
            ...req.jwtData,
            user: refreshTokenUser && reduceUserData(refreshTokenUser),
          }
        }
      )
    } else
      req.jwtData = {
        ...req.jwtData,
        user: user && reduceUserData(user),
      }
  })

  if (req.jwtData.user) {
    // verify user in db
    const fnFindUser = async (db, promise) => {
      const userCollection = db.collection("User")
      let existingUser = await userCollection
        .findOne({
          _id: ObjectID(req.jwtData.user._id),
          username: req.jwtData.user.username,
          email: req.jwtData.user.email.toLowerCase(),
        })
        .catch(() => undefined)

      promise.resolve(existingUser)
    }
    const dbUser = await mongoConnect(fnFindUser)
    if (dbUser) {
      // create a fresh token
      const [newAccessToken, newRefreshToken] = createTokens(req.jwtData.user)
      req.jwtData.accessToken = newAccessToken
      req.jwtData.refreshToken = newRefreshToken
      return next()
    } else return res.send(failedError)
  }
}

// core token functions
function setJwtCookie(res, cookieName, token, expire, httpOnly) {
  const secure = false //process.env["MG_ENV"] !== "local"
  let expires = new Date()
  const milliseconds = expire
    ? -100000000
    : cookieName === jwTokenCookieName
    ? tokenLifespan.access.milliseconds
    : tokenLifespan.refresh.milliseconds
  expires.setMilliseconds(milliseconds)
  res.cookie(cookieName, token, {
    expires,
    httpOnly,
    sameSite: secure ? "None" : "Lax",
    secure,
  })
  return res
}

async function getToken(req, res) {
  const { params: user } = req
  if (!user) return res.sendStatus(401)

  // create a jwt from the valid fetched user
  const [accessToken, refreshToken] = createTokens(user)

  // return the refresh tokens as httponly cookies
  res = setJwtCookie(res, jwTokenCookieName, accessToken, null, true)
  res = setJwtCookie(res, jwRefreshTokenCookieName, refreshToken, null, true)
  return res.send({
    accessToken,
    refreshToken,
    user,
    apiVersion,
  })
}

async function verifyToken(req, res) {
  const {
    cookies: { [jwTokenCookieName]: token },
  } = req
  if (!token) return res.sendStatus(401)

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, data) => {
    if (err) return res.sendStatus(403)
    return res.send(data)
  })
}

async function removeToken(req, res) {
  const {
    cookies: {
      [jwTokenCookieName]: accessToken,
      [jwRefreshTokenCookieName]: refreshToken,
    },
  } = req

  jwt.verify(
    accessToken,
    process.env.ACCESS_TOKEN_SECRET,
    (err, accessTokenUser) => {
      if (err || !accessTokenUser) return res.sendStatus(403)

      jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        (err, refreshTokenUser) => {
          if (
            err ||
            !refreshTokenUser ||
            accessTokenUser["email"] !== refreshTokenUser["email"]
          )
            return res.sendStatus(403)

          const foundToken = refreshTokens.find(token => token === refreshToken)

          removeRefreshToken(refreshToken)
          res = setJwtCookie(res, jwTokenCookieName, "", new Date(), true)
          res = setJwtCookie(
            res,
            jwRefreshTokenCookieName,
            "",
            new Date(),
            true
          )

          if (!foundToken) return res.sendStatus(204)
          else return res.status(200).send("DELETED")
        }
      )
    }
  )
}

async function removeUnverifiedToken(req, res) {
  const {
    cookies: {
      [jwTokenCookieName]: accessToken,
      [jwRefreshTokenCookieName]: refreshToken,
    },
  } = req

  const foundToken = refreshTokens.find(token => token === refreshToken)

  removeRefreshToken(refreshToken)
  res = setJwtCookie(res, jwTokenCookieName, "", new Date(), true)
  res = setJwtCookie(res, jwRefreshTokenCookieName, "", new Date(), true)

  if (!foundToken) return res.sendStatus(204)
  else return res.status(200).send("DELETED")
}

// helpers
function createTokens(user) {
  return [createAccessToken(user), createRefreshToken(user)]
}
function createAccessToken(user) {
  return jwt.sign(reduceUserData(user), process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: tokenLifespan.access.unitMeasurement,
  })
}
function createRefreshToken(user) {
  const refreshToken = jwt.sign(
    reduceUserData(user),
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: tokenLifespan.refresh.unitMeasurement,
    }
  )
  storeRefreshToken(refreshToken)
  return refreshToken
}
function reduceUserData(user) {
  return {
    email: user && user.email,
    username: user && user.username,
    _id: user && user._id,
  }
}

// exports
module.exports = {
  authenticateToken,
  createTokens,
  getToken,
  reduceUserData,
  removeToken,
  verifyToken,
}
