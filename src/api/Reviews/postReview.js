const { mongoConnect } = require("../../mongo")

module.exports = async (req, res) => {
  const {
    body: { geoCoordinates, googlePlaceId, rating, review: reviewText, user },
    jwtData,
  } = req

  const valid = jwtData.user._id === user._id
  const review = {
    geoCoordinates,
    googlePlaceId,
    rating,
    review: reviewText,
    user,
    timestamp: new Date(),
  }

  if (!valid) res.status(401).send("User ID mismatch.")

  const queryKey = {
    "geoCoordinates.lat": geoCoordinates.lat,
    "geoCoordinates.lng": geoCoordinates.lng,
    "user._id": user._id,
  }

  // db function
  const fnRateAndReview = async (db, promise) => {
    const reviewCollection = db.collection("Review")
    let existingReview = await reviewCollection
      .findOne(queryKey)
      .catch(() => undefined)
    const throttle = new Date()
    throttle.setDate(throttle.getDate() - 1)
    if (existingReview && existingReview.timestamp > throttle) {
      promise.resolve({
        status: 405,
        error: "You may write one review for a each location once per day.",
      })
    } else {
      existingReview = await reviewCollection.insertOne(review).catch(e => {
        console.error(e)
        promise.resolve({ status: 400, error: "Error creating review." })
      })
    }
    if (existingReview) promise.resolve(review)
    else promise.resolve({ status: 400, error: "Error posting review." })
  }

  // db call
  const savedReview = await mongoConnect(fnRateAndReview)

  return res.send(savedReview)
}
