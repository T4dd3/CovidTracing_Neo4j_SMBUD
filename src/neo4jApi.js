require('file-loader?name=[name].[ext]!../node_modules/neo4j-driver/lib/browser/neo4j-web.min.js');
const Movie = require('./models/Movie');
const MovieCast = require('./models/MovieCast');
const _ = require('lodash');
const Person = require('./models/Person');

const neo4j = window.neo4j;
const neo4jUri = process.env.NEO4J_URI;
let neo4jVersion = process.env.NEO4J_VERSION;
if (neo4jVersion === '') {
  // assume Neo4j 4 by default
  neo4jVersion = '4';
}
let database = process.env.NEO4J_DATABASE;
if (!neo4jVersion.startsWith("4")) {
  database = null;
}
const driver = neo4j.driver(
    neo4jUri,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
);

console.log(`Database running at ${neo4jUri}`)

/* I'll clean the old db and create a new one from csv data*/
function createDB() 
{
  const session = driver.session({database: database});
  const creationTx = session.beginTransaction();

  var stats = {};
  stats.deletion = creationTx.run('MATCH(n) DETACH DELETE n;');
  stats.nodePerson = creationTx.run("LOAD CSV FROM 'https://raw.githubusercontent.com/T4dd3/CovidTracing_Neo4j_SMBUD/main/data/PersonData.csv' AS line \
    CREATE (:Person {ssn:line[1], name: line[2], lastname: line[3], email: line[4], gender: line[5],birth_date: date(line[6]), address:line[7], phone_number: toInteger(line[8])});");
  stats.nodeSwab = creationTx.run("LOAD CSV FROM 'https://raw.githubusercontent.com/T4dd3/CovidTracing_Neo4j_SMBUD/main/data/SwabData.csv' AS line \
  CREATE (:Swab {date: date(line[2]), outcome: line[3], type: line[1]});");
  stats.nodeVaccine = creationTx.run("LOAD CSV FROM 'https://raw.githubusercontent.com/T4dd3/CovidTracing_Neo4j_SMBUD/main/data/Vaccine.csv' AS line \
  CREATE (:VaccineShot {type:line[1], date: date(line[2]), numberOfTheShot: toInteger(line[3]), lot:line[4]});");
  stats.nodeActivity = creationTx.run("LOAD CSV FROM 'https://raw.githubusercontent.com/T4dd3/CovidTracing_Neo4j_SMBUD/main/data/Activity.csv' AS line \
  CREATE (:Activity {type:line[1], description: line[2], averageDuration: toInteger(line[3]), endTime: time(line[4]), address: line[5]});");
  stats.relPersonSwab = creationTx.run("match (p:Person),(s:Swab) with p,s limit 500000000 where rand() < 0.002 merge (p)-[:TAKES]->(s);");
  stats.dates = creationTx.run("LOAD CSV FROM 'https://raw.githubusercontent.com/T4dd3/CovidTracing_Neo4j_SMBUD/main/data/Date.csv' AS line \
    CREATE (:Date {date: date(line[1]),time:time(line[2])})");
    // stats.nodes = creationTx.run('CREATE (ma:Person { name: "Mark" }), (mi:Person { name: "Mike" }), (ee:Person { name: "Francis", from: "Italy", klout: 99});');
  // stats.relations = creationTx.run('MATCH (a:Person), (b:Person) WHERE NOT (a)-[:KNOWS]->(b) CREATE (a)-[:KNOWS]->(b), (b)-[:KNOWS]->(a);');
  stats.relPersonFirstVaccine = creationTx.run("WITH range(1,1) as VaccineRange MATCH (v:VaccineShot) where v.numberOfTheShot = 1 WITH collect(v) as vaccines, VaccineRange MATCH (p:Person) where rand() < 0.8  WITH p, apoc.coll.randomItems(vaccines, apoc.coll.randomItem(VaccineRange)) as vaccines  FOREACH (x in vaccines | CREATE (p)-[:GETS]->(x))");
  stats.relPersonSecondVaccine = creationTx.run("WITH range(1,1) as VaccineRange MATCH (v:VaccineShot) where v.numberOfTheShot= 2 WITH collect(v) as vaccines, VaccineRange MATCH (p:Person)-[:GETS]->(v1:VaccineShot) where rand() < 0.5 and v1.numberOfTheShot= 1  WITH p, apoc.coll.randomItems(vaccines, apoc.coll.randomItem(VaccineRange)) as vaccines  FOREACH (x in vaccines | CREATE (p)-[:GETS]->(x))");
  stats.relPersonThirdVaccine = creationTx.run("WITH range(1,1) as VaccineRange MATCH (v:VaccineShot) where v.numberOfTheShot = 3 WITH collect(v) as vaccines, VaccineRange MATCH (p:Person)-[:GETS]->(v1:VaccineShot) where rand() < 0.1 and v1.numberOfTheShot= 2  WITH p, apoc.coll.randomItems(vaccines, apoc.coll.randomItem(VaccineRange)) as vaccines  FOREACH (x in vaccines | CREATE (p)-[:GETS]->(x))");
  stats.relLivesWith = creationTx.run("match (p1:Person),(p2:Person)  with p1,p2  limit 1500000000   where p1.name<>p2.name and p1.address = p2.address    merge (p1)<-[:LIVES_WITH]->(p2);");
  stats.relAppRegisteredContact = creationTx.run("match (p1:Person),(p2:Person),(d:Date)  with p1,p2,d  limit 1500000   where rand()<0.0003 and p2.name<>p1.name    merge (p1)<-[:APP_REGISTERED_CONTACT{date:d.date,time:d.time}]->(p2);");
  stats.relTakesPartIn = creationTx.run("match (p:Person),(a:Activity),(d:Date)  with p,a,d  limit 1500000   where rand()<0.0003     merge (p)<-[:TAKES_PART_IN{date:d.date,time:d.time}]->(a);");
  
  return creationTx.commit().then(() => { return stats; }).
    catch(error => { throw error; }).
    finally(() => { return session.close(); });
}


/* To execute query requested by the user and return a response */
function executeQuery(selectedQuery, parameters) {
  const session = driver.session({database: database});
  
  if (selectedQuery == "HR") {
    return session.readTransaction((tx) =>
          tx.run('MATCH (p:Person) RETURN p LIMIT(100)')
          //tx.run('MATCH (P1:Person)-[LW:LIVES_WITH]-(P2:Person) WHERE P1.ssn = '+parameters.ssn+' AND P2.ssn<>P1.ssn AND LW.endDate IS NULL OR duration.inDays(LW.endDate,'+parameters.swabDate+').days <= 14 RETURN P2')
      )
      .then(result => {
          // Each record will have a person associated, I'll get that person
          return result.records.map(recordFromDB => {
            return new Person(recordFromDB.get("p"));
          });
      })
      .catch(error => {
        throw error;
      })
      .finally(() => {
        return session.close();
      });
  }
  else if (selectedQuery == "SB") 
  {
    return session.writeTransaction((tx) => {
      tx.run('CREATE (S:Swab {date: date(\''+parameters.date+'\'), outcome: \''+parameters.outcome+'\', type: \''+parameters.type+'\'}) WITH S MATCH (P:Person) WHERE P.ssn = \''+parameters.ssn+'\' MERGE (P)<-[:TAKES]->(S)')
    })
    .then(result => {
        return "Successfully added swab to ssn: " + parameters.ssn;
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
  }
}

function searchMovies(queryString) {
  const session = driver.session({database: database});
  return session.readTransaction((tx) =>
      tx.run('MATCH (movie:Movie) \
      WHERE movie.title =~ $title \
      RETURN movie',
      {title: '(?i).*' + queryString + '.*'})
    )
    .then(result => {
      return result.records.map(record => {
        return new Movie(record.get('movie'));
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

function getMovie(title) {
  const session = driver.session({database: database});
  return session.readTransaction((tx) =>
      tx.run("MATCH (movie:Movie {title:$title}) \
      OPTIONAL MATCH (movie)<-[r]-(person:Person) \
      RETURN movie.title AS title, \
      collect([person.name, \
           head(split(toLower(type(r)), '_')), r.roles]) AS cast \
      LIMIT 1", {title}))
    .then(result => {
      if (_.isEmpty(result.records))
        return null;

      const record = result.records[0];
      return new MovieCast(record.get('title'), record.get('cast'));
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

function voteInMovie(title) {
  const session = driver.session({ database: database });
  return session.writeTransaction((tx) =>
      tx.run("MATCH (m:Movie {title: $title}) \
        WITH m, (CASE WHEN exists(m.votes) THEN m.votes ELSE 0 END) AS currentVotes \
        SET m.votes = currentVotes + 1;", { title }))
    .then(result => {
      return result.summary.counters.updates().propertiesSet
    })
    .finally(() => {
      return session.close();
    });
}

function myGetGraph() {
  const session = driver.session({database: database});
  return session.readTransaction((tx) =>
    tx.run('MATCH (p:Person)-[:APP_REGISTERED_CONTACT]->(a:Person) \
    RETURN p.name AS p, collect(a.name) AS regContact \
    LIMIT $limit', {limit: neo4j.int(100)}))
    .then(results => {
      const nodes = [], rels = [];
      let i = 0;
      results.records.forEach(res => {
        nodes.push({name: res.get('p'), label: 'person'});
        const target = i;
        i++;

        res.get('regContact').forEach(name => {
          const regContactPerson = {name: name, label: 'person'};
          let source = _.findIndex(nodes, regContactPerson);
          if (source === -1) {
            nodes.push(regContactPerson);
            source = i;
            i++;
          }
          rels.push({source, target})
        })
        
      });

      return {nodes, links: rels};
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

exports.searchMovies = searchMovies;
exports.getMovie = getMovie;
exports.voteInMovie = voteInMovie;
exports.executeQuery = executeQuery;
exports.myGetGraph = myGetGraph;
exports.createDB = createDB;