const request = require('supertest')
const app = require('./index')

describe("Sample Test", () => {
  it("should test that true === true", () => {
    expect(true).toBe(true)
  })
})

describe('GET Endpoints', () => {
  it('should receive a GET response', async () => {
    const res = await request(app)
      .get('/test/_A_/_B_/?querystring_param1=_C_')
      .end((error, response) => {
        if (error) {
          return error;
        }

        return response;
      })
    expect(res.statusCode).toEqual(200)
    expect(res.body).toHaveProperty('1')
  })
})

// describe("testing-server-routes", () => {
//   it("GET /test/:param1/:param2 - success", async () => {
//     const { body } = await request(app).get(
//       "/test/_A_/_B_/?querystring_param1=_C_"
//     ) //uses the request function that calls on express app instance
//     expect(body).toEqual({
//       params: {
//         param1: "_A_",
//         param2: "_B_",
//       },
//       query: {
//         querystring_param1: "_C_",
//       },
//     })
//   })
// })
