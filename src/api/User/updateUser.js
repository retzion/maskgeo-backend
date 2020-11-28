const { mongoConnect } = require("../../mongo")

module.exports = async ({ query, updates }) => {
  const fnUpdateUser = async db => {
    const userCollection = db.collection("User")
    return await userCollection.updateOne(query, { $set: updates })
  }
  return mongoConnect(fnUpdateUser)
}
