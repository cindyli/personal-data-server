"use strict";

const express = require("express");
const router = express.Router();
const axios = require("axios");

const pdsServer = "http://localhost:3000";

// The callback endpoint for Personal Data Server to pass back the login token at the end of the login process
// when the user is authenticated.
router.get("/redirect", function (req, res) {
    const loginToken = req.query.loginToken;
    const maxAge = req.query.maxAge;
    const refererUrl = req.query.refererUrl;

    if (!loginToken || !maxAge || !refererUrl) {
        res.status(401).json({
            message: "Missing required parameters"
        });
    } else {
        res.cookie("PDS_loginToken", loginToken, {
            path: "/",
            maxAge: maxAge,
            sameSite: true
        });
        res.redirect(refererUrl);
    }
});

// Relay the get preferences call to the Personal Data Server
router.get("/get_prefs", async function (req, res) {
    if (!req.cookies || !req.cookies.PDS_loginToken) {
        res.status(401).json({
            message: "Unauthorized. Missing 'PDS_loginToken' cookie value."
        });
    } else {
        const preferences = await axios.get(pdsServer + "/get_prefs", {
            headers: {
                "Authorization": "Bearer " + req.cookies.PDS_loginToken
            }
        });
        res.send(preferences.data);
    }
});

// Relay the save preferences call to the Personal Data Server
router.post("/save_prefs", async function (req, res) {
    if (!req.cookies || !req.cookies.PDS_loginToken) {
        res.status(401).json({
            "message": "Unauthorized. Missing 'PDS_loginToken' cookie value."
        });
    } else {
        const preferences = req.body;
        // Note: when the incoming request body is `undefined` or `null`, express.json() middleware will
        // convert it into an empty object. This empty object will then be saved.
        // See: https://github.com/expressjs/body-parser/blob/master/lib/types/json.js#L74
        await axios.post(pdsServer + "/save_prefs", preferences, {
            headers: {
                "Authorization": "Bearer " + req.cookies.PDS_loginToken
            }
        });
        res.send(preferences);
    }
});

module.exports = router;
