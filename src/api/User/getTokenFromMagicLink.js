const crypto = require("crypto")
const { mongoConnect } = require("../../mongo")
const { getToken } = require("../../auth")
const updateUser = require("./updateUser")

module.exports = async (req, res) => {
  const { token } = req.params

  // required parameters
  if (!token) return res.sendStatus(400)

  let magicLinkTokenHash
  try {
    magicLinkTokenHash = crypto.createHmac("sha256", token).digest("hex")
  } catch (e) {}
  if (!magicLinkTokenHash) res.status(403).send("Token was invalid.")

  const findQuery = { "authTokens.hex": magicLinkTokenHash }

  // db function to search for token hash
  const fnFindUserByToken = async db => {
    const userCollection = db.collection("User")
    let existingUser = await userCollection
      .findOne(findQuery)
      .catch(() => undefined)

    if (existingUser) {
      const { exp, verify } = existingUser.authTokens.find(
        t => t.hex === magicLinkTokenHash
      )
      if (exp < new Date()) return res.status(403).send("Token has expired.")
      else {
        let updates = {
          userAgent: req.headers["user-agent"],
          lastSession: new Date(),
        }
        updates.emailVerified = existingUser.emailVerified || verify === "email"
        updates.phoneVerified = existingUser.phoneVerified || verify === "phone"

        updateUser({
          query: findQuery,
          updates,
        })
        
        return getToken(
          {
            ...req,
            params: {
              email: existingUser.email,
              emailVerified: updates.emailVerified,
              phone: existingUser.phone,
              phoneVerified: updates.phoneVerified,
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
