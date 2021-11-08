require('file-loader?name=[name].[ext]!./assets/images/favicon.ico')
const api = require('./neo4jApi');

$(function () {
  renderGraph();
 // search();

  $("#search").submit(e => {
    //console.log("ciao");
    e.preventDefault();
    //search();
    executeQuery();
  });

  $("#dbCreation").submit(e => {
   // console.log("ciaooo");
    e.preventDefault();
    createDB();
  });
});

// Function used to invoke db creation server side
function createDB() 
{
  api.createDB().then(res => {
    console.log(res);
    alert("Database successfully created and initialized!");
    renderGraph();
    // In res ci sono tutte le statistiche delle query (nodi creati, relazioni create, label aggiunte,..), ogni proprietà è una query che è stata eseguita
    // res.nodePersons._p.then((res) => console.log(res.summary.counters._stats))
  })
}

// Function that executes query
function executeQuery()
{
 //console.log("ciao");
  var selectedQuery = document.getElementById("search");


  if(selectedQuery=="HR"){
    //document.getElementsByClassName("row")[1].style.display ="none";
    var parametersHR = {};
    parametersHR.ssn = document.getElementById("InputHR").getElementById("SSN_HR");

  }
  if(selectedQuery=="SB"){
    var parametersSB = {};
    parametersSB.ssn = document.getElementById("InputSB").getElementById("SSN_SB");
    parametersSB.date = document.getElementById("InputSB").getElementById("Date_SB");
    parametersSB.type = document.getElementById("InputSB").getElementById("Type_SB");
    parametersSB.outcome = document.getElementById("InputSB").getElementById("Outcome_SB");
  
  }
  api.executeQuery().then(persons => {
    // I receive a list of persons
    console.log(persons);
  });


}

//Function that show the filling Label based on the combo's choice

function showLabel(){
 //document.getElementById(1).style.display ="none";
 //document.getElementsByClassName("row")[1].style.display ="none";

}

function showMovie(title) {
  api
    .getMovie(title)
    .then(movie => {
      if (!movie) return;

      $("#title").text(movie.title);
      $("#poster").attr("src","https://neo4j-documentation.github.io/developer-resources/language-guides/assets/posters/"+encodeURIComponent(movie.title)+".jpg");
      const $list = $("#crew").empty();
      movie.cast.forEach(cast => {
        $list.append($("<li>" + cast.name + " " + cast.job + (cast.job === "acted" ? " as " + cast.role : "") + "</li>"));
      });
      $("#vote")
        .unbind("click")
        .click(function () {
          voteInMovie(movie.title)
        })
    }, "json");
}

function voteInMovie(title) {
  api.voteInMovie(title)
    .then(() => search(false))
    .then(() => showMovie(title));
}

function search(showFirst = true) {
  const query = $("#search").find("input[name=search]").val();
  api
    .searchMovies(query)
    .then(movies => {
      const t = $("table#results tbody").empty();

      if (movies) {
        movies.forEach((movie, index) => {
          $('<tr>' + 
              `<td class='movie'>${movie.title}</td>` + 
              `<td>${movie.released}</td>` +
              `<td>${movie.tagline}</td>` + 
              `<td id='votes${index}'>${movie.votes}</td>` +
            '</tr>')
            .appendTo(t)
            .click(function() {
              showMovie($(this).find("td.movie").text());
            })
        });

        const first = movies[0];
        if (first && showFirst) {
          return showMovie(first.title);
        }
      }
    });
}

function renderGraph() {
  const width = 800, height = 800;
  const force = d3.layout.force()
    .charge(-200).linkDistance(30).size([width, height]);

  const svg = d3.select("#graph").append("svg")
    .attr("width", "100%").attr("height", "100%")
    .attr("pointer-events", "all");

  api.myGetGraph().then(graph => {
    force.nodes(graph.nodes).links(graph.links).start();

      const link = svg.selectAll(".link")
        .data(graph.links).enter()
        .append("line").attr("class", "link");

      const node = svg.selectAll(".node")
        .data(graph.nodes).enter()
        .append("circle")
        .attr("class", d => {
          return "node " + d.label
        })
        .attr("r", 10)
        .call(force.drag);

      // html title attribute
      node.append("title")
        .text(d => {
          return d.name;
        });

      // force feed algo ticks
      force.on("tick", () => {
        link.attr("x1", d => {
          return d.source.x;
        }).attr("y1", d => {
          return d.source.y;
        }).attr("x2", d => {
          return d.target.x;
        }).attr("y2", d => {
          return d.target.y;
        });

        node.attr("cx", d => {
          return d.x;
        }).attr("cy", d => {
          return d.y;
        });
      });
  });
}
