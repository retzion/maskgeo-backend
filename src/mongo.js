const MongoClient = require('mongodb').MongoClient
const ObjectID = require('mongodb').ObjectID
const assert = require('assert')

// Import some environment variables
const {
  MG_DBNAME: dbName,
  MG_DBURI: dbUri,
  MG_DBUSER: dbUser,
  MG_DBPASSWORD: dbPassword
} = process.env

// Connection URL
const mongoUri = `mongodb+srv://${dbUser}:${encodeURIComponent(dbPassword)}@${dbUri}/${dbName}?retryWrites=true&w=majority`;

module.exports = {
  ObjectID,
  mongoConnect: (fn) => {
    return new Promise(async (resolve, reject) => {
      try {
        const mongo = new MongoClient(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
        mongo.connect(async (err) => {
          assert.strictEqual(null, err)
      
          const db = mongo.db(dbName)
          const promise = { resolve, reject }
          await fn(db, promise)
          mongo.close()
        })
      } catch (err) { reject(err.message || err) }
    })
  }
}
