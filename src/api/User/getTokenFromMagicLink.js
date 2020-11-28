const crypto = require("crypto")
const { mongoConnect } = require("../../mongo")
const { getToken } = require("../../auth")
const updateUserUserAgent = require("./updateUserUserAgent")

module.exports = async (req, res) => {
  const { token } = req.params

  // required parameters
  if (!token) return res.sendStatus(400)

  let magicLinkTokenHash
  try {
    magicLinkTokenHash = crypto.createHmac("sha256", token).digest("hex")
  } catch (e) {}
  if (!magicLinkTokenHash) res.status(403).send("Token was invalid.")

  const findQuery = { magicLinkTokenHash }

  // db function to search for token hash
  const fnFindUserByToken = async (db, promise) => {
    const userCollection = db.collection("User")
    let existingUser = await userCollection
      .findOne(findQuery)
      .catch(() => undefined)

    if (existingUser) {
      if (existingUser.magicLinkExpires < new Date())
        return res.status(403).send("Token has expired.")
      else {
        updateUserUserAgent({ findQuery, userAgent: req.headers["user-agent"] })
        return getToken(
          {
            ...req,
            params: {
              email: existingUser.email,
              username: existingUser.username,
              _id: existingUser._id,
            },
          },
          res
        )
      }
    } else res.status(403).send("Token was invalid.")
  }

  // db call
  mongoConnect(fnFindUserByToken)
}
