const { mongoConnect } = require("../../mongo")

module.exports = ({ query, updates }) => {
  const fnUpdateUser = db => {
    const userCollection = db.collection("User")
    return userCollection.updateOne(query, { $set: updates })
  }
  return mongoConnect(fnUpdateUser)
}
