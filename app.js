const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());
const db = null;
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDbObjectToResponseObjectForDistrict = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
   SELECT
    *
   FROM
    state
   ORDER BY
    state_id;`;
  const StatesArray = await db.all(getStatesQuery);
  response.send(
    StatesArray.map((each) => convertDbObjectToResponseObject(each))
  );
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
   SELECT
    *
   FROM
    state
   WHERE
    state_id=${stateId}`;
  const StateArray = await db.get(
    getStateQuery.map((each) => convertDbObjectToResponseObject(each))
  );
  response.send(StateArray);
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const putStatesQuery = `
   
    INSERT INTO
    district (district_name,state_id,cases,cured,active,deaths)
    VALUES
    (${districtName},
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths},
        );`;
  await db.run(putStatesQuery);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
   SELECT
    *
   FROM
    district
   WHERE
    district_id=${districtId}`;
    const DistrictArray = await db.get(getDistrictQuery);
    response.send(
      DistrictArray.map((each) =>
        convertDbObjectToResponseObjectForDistric(each)
      )
    );
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
   DELETE FROM
    district
   WHERE
    district_id=${districtId}`;
    await db.run(getDistrictQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const putStatesQuery = `
   
    UPDATE
    district 
    SET
    district_name=${districtName},
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths},
    WHERE
    district_id=${districtId}
        ;`;
    await db.run(putStatesQuery);
    response.send("District Details Updated");
  }
);

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatsQuery = `
   SELECT
    SUM(cases),
    SUM(cured),
    SUM(active),
    SUM(deaths)
   FROM
    district
   WHERE
    state_id=${stateId}`;
  const StatsArray = await db.get(getStatsQuery);
  response.send({
    totalCases: Stats["SUM(cases)"],
    totalCured: Stats["SUM(cured)"],
    totalActive: Stats["SUM(active)"],
    totalDeaths: Stats["SUM(deaths)"],
  });
});
module.exports = app;
