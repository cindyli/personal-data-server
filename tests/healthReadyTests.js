/*
 * Copyright 2021-2022 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 */

"use strict";

require("json5/lib/register");
const fluid = require("infusion");
const jqUnit = require("node-jqunit");

require("../src/shared/driverUtils.js");
require("./shared/utilsCommon.js");
require("./shared/utilsSso.js");

jqUnit.module("Personal Data Server /health and /ready tests.");

fluid.registerNamespace("fluid.tests.healthReady");

const skipDocker = process.env.SKIPDOCKER === "true" ? true : false;
const path = require("path");
const config = require("../src/shared/utils.js").loadConfig(path.join(__dirname, "testConfig.json5"));
const serverUrl = "http://localhost:" + config.server.port;
fluid.tests.utils.setDbEnvVars(config.db);

const postgresOps = require("../src/dbOps/postgresOps.js");
const postgresHandler = new postgresOps.postgresOps(config.db);

const server = require("../server.js");

jqUnit.test("Health and Ready end point tests", async function () {
    jqUnit.expect(skipDocker ? 15 : 18);
    let serverStatus, response;

    // Start with server off -- "/health" should fail
    response = await fluid.tests.utils.sendRequest(serverUrl, "/health");
    jqUnit.assertNotNull("Check '/health' error", response);
    jqUnit.assertTrue("Check '/health' error code", response.toString().includes("ECONNREFUSED"));

    // Start server, but not the database.
    const serverInstance = server.startServer(config.server.port);
    serverStatus = await fluid.personalData.getServerStatus(config.server.port);
    jqUnit.assertTrue("The server is up and running", serverStatus);

    // "/health" request should now succeed ...
    response = await fluid.tests.utils.sendRequest(serverUrl, "/health");
    fluid.tests.healthReady.testResult(response, 200, { isHealthy: true }, "/health (should succeed)");

    if (!skipDocker) {
        // But "/ready" should fail if the local database is not running.
        // In the case the local database is running with skipDocker set to true, the server will always be ready.
        response = await fluid.tests.utils.sendRequest(serverUrl, "/ready");
        fluid.tests.healthReady.testResult(response, 503, { isError: true, message: "Database is not ready" }, "/ready (should error)");

        // Start the database docker container
        response = await fluid.personalData.dockerStartDatabase(config.db.dbContainerName, config.db.dbDockerImage, config.db);
        jqUnit.assertTrue("The database has been started successfully", response.dbReady);
    }

    // Create db
    response = await fluid.personalData.createDB(config.db);
    jqUnit.assertTrue("The database " + config.db.database + " has been created successfully", response.isCreated);

    // Clear the database for a fresh start
    response = await fluid.personalData.clearDB(postgresHandler, fluid.tests.sqlFiles.clearDB);
    jqUnit.assertTrue("The database " + config.db.database + " has been cleared successfully", response.isCleared);

    // Initialize db: create tables and load data
    response = await fluid.personalData.initDB(postgresHandler, fluid.tests.sqlFiles);
    jqUnit.assertTrue("The database " + config.db.database + " has been initialized successfully", response.isInited);

    // "/ready" should now work.
    response = await fluid.tests.utils.sendRequest(serverUrl, "/ready");
    fluid.tests.healthReady.testResult(response, 200, { isReady: true }, "/ready (should succeed)");

    // Final clean up
    // 1. Disconnect the postgres client from its server. See https://node-postgres.com/api/client
    await fluid.tests.utils.finish(postgresHandler);

    if (!skipDocker) {
        // 2. Stop the docker container for the database
        response = await fluid.personalData.dockerStopDatabase(config.db.dbContainerName);
        jqUnit.assertTrue("The database docker container has been stopped", response.dbStopped);
    }

    // 3. Stop the server
    await server.stopServer(serverInstance);
    serverStatus = await fluid.personalData.getServerStatus(config.server.port);
    jqUnit.assertFalse("The server has been stopped", serverStatus);
});

fluid.tests.healthReady.testResult = async function (res, expectedStatus, expected, endPoint) {
    jqUnit.assertNotNull("Check '" + endPoint + "' non-null response", res);
    jqUnit.assertEquals("Check '" + endPoint + "' response status", expectedStatus, res.status);
    jqUnit.assertDeepEq("Check '" + endPoint + "' response", expected, res.data);
};
