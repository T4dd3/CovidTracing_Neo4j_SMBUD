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
  stats.deletion = creationTx.run('MATCH(n) DETACH DELETE n;');;
  stats.nodes = creationTx.run('CREATE (ma:Person { name: "Mark" }), (mi:Person { name: "Mike" }), (ee:Person { name: "Francis", from: "Italy", klout: 99});');
  stats.relations = creationTx.run('MATCH (a:Person), (b:Person) WHERE NOT (a)-[:KNOWS]->(b) CREATE (a)-[:KNOWS]->(b), (b)-[:KNOWS]->(a);');

  return creationTx.commit().then(() => { return stats; }).
    catch(error => { throw error; }).
    finally(() => { return session.close(); });


  return session.writeTransaction((tx) => 
      tx.run('MATCH(n) DETACH DELETE n;')
    )
    .then(result => {
      // Each record will have a person associated, I'll get that person
      return session.writeTransaction((tx) => 
      tx.run('CREATE (ma:Person { name: "Mark" }), (mi:Person { name: "Mike" }), (ee:Person { name: "Francis", from: "Italy", klout: 99});')
      )
      .then(result => {
        return session.writeTransaction((tx) => 
        tx.run('MATCH (a:Person), (b:Person) WHERE NOT (a)-[:KNOWS]->(b) CREATE (a)-[:KNOWS]->(b), (b)-[:KNOWS]->(a);')
        )
        .then(result => {
          // Each record will have a person associated, I'll get that person
          return result;
        })
        .catch(error => {
          throw error;
        })
        .finally(() => {
          
        });
      })
      .catch(error => { throw error; })
      .finally(() => {  });
    })
    .catch(error => { throw error; })
    .finally(() => { return session.close(); });
}


/* To execute query requested by the user and return a response */
function executeQuery() {
  const session = driver.session({database: database});
  
  return session.readTransaction((tx) => 
      tx.run('match(person:Person) return person')
    )
    .then(result => {
      // Each record will have a person associated, I'll get that person
      return result.records.map(recordFromDB => {
        return new Person(recordFromDB.get("person"));
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
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
    tx.run('MATCH (p:Person)<-[:KNOWS]-(a:Person) \
    RETURN p.name AS p, collect(a.name) AS known \
    LIMIT $limit', {limit: neo4j.int(100)}))
    .then(results => {
      const nodes = [], rels = [];
      let i = 0;
      results.records.forEach(res => {
        nodes.push({name: res.get('p'), label: 'person'});
        const target = i;
        i++;

        res.get('known').forEach(name => {
          const knownPerson = {name: name, label: 'person'};
          let source = _.findIndex(nodes, knownPerson);
          if (source === -1) {
            nodes.push(knownPerson);
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
/*
function getGraph() {
  const session = driver.session({database: database});
  return session.readTransaction((tx) =>
    tx.run('MATCH (m:Movie)<-[:ACTED_IN]-(a:Person) \
    RETURN m.title AS movie, collect(a.name) AS cast \
    LIMIT $limit', {limit: neo4j.int(100)}))
    .then(results => {
      const nodes = [], rels = [];
      let i = 0;
      results.records.forEach(res => {
        nodes.push({title: res.get('movie'), label: 'movie'});
        const target = i;
        i++;

        res.get('cast').forEach(name => {
          const actor = {title: name, label: 'actor'};
          let source = _.findIndex(nodes, actor);
          if (source === -1) {
            nodes.push(actor);
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
*/
exports.searchMovies = searchMovies;
exports.getMovie = getMovie;
exports.voteInMovie = voteInMovie;
exports.executeQuery = executeQuery;
exports.myGetGraph = myGetGraph;
exports.createDB = createDB;