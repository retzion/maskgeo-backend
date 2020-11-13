const crypto = require("crypto")
const { ObjectID, mongoConnect } = require("../mongo")
const { getToken } = require("../auth")
const { sendMail } = require("../util")
// const { create } = require("domain")

async function createUser(req, res) {
  try {
    // destructure parameters
    let {
      body: { email, username },
    } = req
    email = email.toLowerCase()

    // required parameters
    if (!email || !username) return res.sendStatus(400)

    // validate email format
    const validEmailExp = new RegExp(/^([a-zA-Z0-9 \@\._-]+)$/)
    const validEmail = validEmailExp.test(email)
    if (!validEmail)
      return res.status(422).send("Invalid characters found in email.")

    // validate username format
    const validUserExp = new RegExp(/^([a-zA-Z0-9_]+)$/)
    const validUsername = validUserExp.test(username)
    if (!validUsername)
      return res.status(422).send("Invalid characters found in username.")

    /** Insert the user */
    const userFindKey = {
      $or: [{ username: { $regex: new RegExp(username, "i") } }, { email }],
    }
    const [magicLinkToken, magicLinkTokenHash] = createMagicLinkAndHash()

    // db function
    const fnCreateUser = async (db, promise) => {
      const userCollection = db.collection("User")
      let existingUser = await userCollection
        .findOne(userFindKey)
        .catch(() => undefined)
      if (existingUser) {
        if (existingUser.email === email)
          promise.resolve({error: "Email address already exists."})
        if (existingUser.username.toLowerCase() === username.toLowerCase())
          promise.resolve({error: "Username already exists."})
      } else {
        const magicLinkExpires = new Date()
        magicLinkExpires.setMinutes(magicLinkExpires.getMinutes() + 10)
        existingUser = await userCollection
          .insertOne({ email, username, magicLinkTokenHash, magicLinkExpires })
          .catch(e => {
            console.error(e)
            promise.resolve({error: "Error creating user."})
          })
      }
      if (existingUser) promise.resolve(existingUser)
      else promise.resolve({error: "Error creating user."})
    }

    // db call
    const createdUser = await mongoConnect(fnCreateUser)
      .catch(console.error)

    // send response
    if (!createdUser) return res.sendStatus(500)
    else if (createdUser.error) return res.send(createdUser)
    else {
      /** @DEV Create and email a magic link containing a token to fetch a JWT */
      await sendMail(email, "MaskForecast Magic Link", "new-account", {
        email,
        username,
        expires: "in 10 minutes",
        link: `${req.headers.origin}/token/${magicLinkToken}`,
        buttonBackgroundColor: "cornflowerblue",
        buttonTextColor: "#ffffff",
      })
      res.sendStatus(200)
    }
  } catch (err) {
    console.error(err)
    return res.status(500).send(err)
  }
}

async function getTokenFromMagicLink(req, res) {
  const { token } = req.params

  // required parameters
  if (!token) return res.sendStatus(400)

  let magicLinkTokenHash
  try {
    magicLinkTokenHash = crypto.createHmac("sha256", token).digest("hex")
  } catch (e) {}
  if (!magicLinkTokenHash) res.status(403).send("Token was invalid.")

  // db function
  const fnFindUserByToken = async (db, promise) => {
    const userCollection = db.collection("User")
    let existingUser = await userCollection
      .findOne({ magicLinkTokenHash })
      .catch(() => undefined)

    if (existingUser) {
      if (existingUser.magicLinkExpires < new Date())
        return res.status(403).send("Token has expired.")
      else
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
    } else res.status(403).send("Token was invalid.")
  }

  // db call
  mongoConnect(fnFindUserByToken)
}

async function requestMagicLoginLink(req, res) {
  const { email } = req.params
  let userData

  // required parameters
  if (!email) return res.sendStatus(400)

  // new data to update
  const [magicLinkToken, magicLinkTokenHash] = createMagicLinkAndHash()
  const magicLinkExpires = new Date()
  magicLinkExpires.setMinutes(magicLinkExpires.getMinutes() + 10)

  // db function
  const fnUpdateMagicLinkData = async (db, promise) => {
    const userCollection = db.collection("User")
    userData = await userCollection
      .findOne({ email: email.toLowerCase() })
      .catch(() => undefined)
    if (userData) {
      const updated = await userCollection
        .updateOne(
          { _id: new ObjectID(userData._id) },
          { $set: { magicLinkTokenHash, magicLinkExpires } }
        )
        .catch(e => {
          console.error(e)
          promise.resolve()
        })
      if (updated) promise.resolve(updated)
      else promise.resolve()
    } else promise.resolve()
  }

  // db call
  const updatedUser = await mongoConnect(fnUpdateMagicLinkData)

  if (
    updatedUser &&
    updatedUser.result.nModified === 1 &&
    updatedUser.result.ok === 1
  ) {

    // send response
    /** @DEV Create and email a magic link containing a token to fetch a JWT */
    sendMail(email, "MaskForecast Magic Link", "magic-link", {
      email,
      username: userData.username,
      expires: "in 10 minutes",
      link: `${req.headers.origin}/token/${magicLinkToken}`,
      buttonBackgroundColor: "cornflowerblue",
      buttonTextColor: "#ffffff",
    })
    res.send()
  } else res.sendStatus(400)
}

function createMagicLinkAndHash() {
  const magicLinkToken = crypto.randomBytes(20).toString("hex")
  const magicLinkTokenHash = crypto
    .createHmac("sha256", magicLinkToken)
    .digest("hex")
  return [magicLinkToken, magicLinkTokenHash]
}

module.exports = {
  createUser,
  getTokenFromMagicLink,
  requestMagicLoginLink,
}
