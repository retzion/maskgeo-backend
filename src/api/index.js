const { mongoConnect } = require("../mongo")
const auth = require("../auth")
const reviews = require("./Reviews")
const user = require("./User")

function logError(payload) {
  mongoConnect(async db => {
    await db.collection("Error").insertOne(payload)
  })
}

/**
 * @title testConnection
 *
 * @dev Test for a connection to the MongoDB database
 */
function testConnection() {
  // db function
  const fnTestConnection = async (db, promise) => {
    const results = await db
      .collection("User")
      .findOne()
      .catch(() => false)
    console.dir(results)
    if (results === false) promise.reject("no connection")
    else promise.resolve(results)
  }
  return mongoConnect(fnTestConnection)
}

// get a json web token
function getToken(req, res) {
  req.checkUser = checkUser
  return auth.getToken(req, res)
}

/**
 * @title checkUser
 * @dev Query the server to confirm the user is valid
 * @todo Determine the authentication setup we want
 *
 * @param {object} user
 * @param {boolean} returnAllData Null/false will return non-sensitive data only
 *
 * @returns {object} User object
 */
async function checkUser(user, returnAllData) {
  // validation
  if (!user || !user.sid) return

  // // send our own request for the user data
  // if (environment) bugCatcherApi.setApiUri( bugcatcherUris[environment] )
  // bugCatcherApi.setSid( user.sid )
  // const getUserData = await bugCatcherApi.getUserData( user )
  //   .catch(() =>  undefined)
  // if (!getUserData) return

  // const { data: verifiedUser } = getUserData
  // if (!verifiedUser) return
  // if (user.email && user.email !== verifiedUser.email) return

  user = {
    username: user.sid,
  }

  if (returnAllData) return user
  // for later when we have more user data
  else return user
}

module.exports = {
  createUser: user.createUser,
  fetchReviews: reviews.fetchReviews,
  getToken,
  getTokenFromMagicLink: user.getTokenFromMagicLink,
  logError,
  postReview: reviews.postReview,
  removeToken: auth.removeToken,
  requestMagicLoginLink: user.requestMagicLoginLink,
  testConnection,
  updateUser: user.updateUser,
  verifyToken: auth.verifyToken,
}
