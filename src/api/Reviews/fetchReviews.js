const { mongoConnect } = require("../../mongo")

module.exports = async (req, res) => {
  let {
    query: { geoCoordinates, googlePlaceId },
  } = req
  geoCoordinates = typeof geoCoordinates === 'string' ? JSON.parse(geoCoordinates) : {}

  const queryKey = {
    $or: [
      { geoCoordinates },
      { googlePlaceId },
    ],
  }

  // db function
  const fnFetchReviews = async (db, promise) => {
    const reviewCollection = db.collection("Review")
    let existingReviews = await reviewCollection
      .find(queryKey)
      .toArray()

      .catch(() => undefined)

    if (existingReviews)
      promise.resolve(
        existingReviews.map(r => {
          delete r.geoCoordinates
          delete r.googlePlaceId
          return r
        })
      )
    else promise.resolve({ error: "Error fetching reviews." })
  }

  // db call
  const reviews = await mongoConnect(fnFetchReviews)

  if (reviews.error) res.status(405)
  return res.send(reviews)
}
