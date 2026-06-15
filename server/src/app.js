// Create the application

import express, { json } from "express"
const app = express();
app.use = (express.json())

app.get("/", (req, res) =>{
    res.json({
        message: "Server is Rinning"
    })
})

export default app;