const jwt = require("jsonwebtoken")

// config
const accessMinuteLifespan = 10
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
function authenticateToken(req, res, next) {
  const {
    cookies: {
      [jwTokenCookieName]: token,
      [jwRefreshTokenCookieName]: refreshToken,
    },
  } = req
  if (!token && !refreshToken) return res.sendStatus(403)

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      // the access token cannot be verified so we validate the refresh token
      jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
        (err, refreshTokenUser) => {
          if (err) return res.sendStatus(403)
          req.jwtData = refreshTokenUser
        }
      )
    } else req.jwtData = reduceUserData(user)

    if (req.jwtData) {
      // create a fresh token
      const accessToken = createAccessToken(req.jwtData)

      // return the the access token as an HttpOnly cookie
      res = setJwtCookie(req, res, jwTokenCookieName, accessToken)
    }
    return next()
  })
}

// core token functions
function setJwtCookie(req, res, cookieName, token, expire) {
  const secure =
    (req.protocol && req.protocol.includes("https")) ||
    (req.headers.referer && req.headers.referer.includes("https"))
  console.log({ secure })
  let expires = new Date()
  const milliseconds = expire
    ? -1000
    : cookieName === jwTokenCookieName
    ? tokenLifespan.access.milliseconds
    : tokenLifespan.refresh.milliseconds
  expires.setMilliseconds(milliseconds)
  res.cookie(cookieName, token, {
    expires,
    httpOnly: true,
    sameSite: secure ? "None" : "Lax",
    secure,
  })
  return res
}

async function getToken(req, res) {
  const { params: user } = req
  if (!user) return res.sendStatus(401)

  // create a jwt from the valid fetched user
  const accessToken = createAccessToken(user)
  const refreshToken = createRefreshToken(user)

  // return the refresh tokens as httponly cookies
  res = setJwtCookie(req, res, jwTokenCookieName, accessToken)
  res = setJwtCookie(req, res, jwRefreshTokenCookieName, refreshToken)
  return res.send(user)
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
          res = setJwtCookie(req, res, jwTokenCookieName, "", true)
          res = setJwtCookie(req, res, jwRefreshTokenCookieName, "", true)

          if (!foundToken) return res.sendStatus(204)
          else return res.status(200).send("DELETED")
        }
      )
    }
  )
}

// helpers
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
    email: user.email,
    username: user.username,
    _id: user._id,
  }
}

// exports
module.exports = {
  authenticateToken,
  getToken,
  removeToken,
  verifyToken,
}
