require('file-loader?name=[name].[ext]!./assets/images/favicon.ico')
const api = require('./neo4jApi');

$(function () {
  renderGraph();
  
 // search();
  var select = document.getElementById("queryToExecute");
  select.addEventListener('change', (event) => {
    changeShowed(event.target.value);
  });
  changeShowed(select.value);

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
    // In res ci sono tutte le statistiche delle query (nodi creati, relazioni create, label aggiunte,..), ogni proprietà è una query che è stata eseguita
    // res.nodePersons._p.then((res) => console.log(res.summary.counters._stats))
  })
}

function ViewHRPagination(){
    if ($('#navigatorData').length == 0)
      $('#ViewHRData').after('<div id="navigatorData"></div>');
    else
      $('#navigatorData').empty();

    var rowsShown = 10;
    var rowsTotal = $('#ViewHRData tbody tr').length;
    var numPages = rowsTotal/rowsShown;
    
    for(i = 0;i < numPages;i++) {
        var pageNum = i + 1;
        $('#navigatorData').append('<a href="#" rel="'+i+'">'+pageNum+'</a> ');
    }
    $('#ViewHRData tbody tr').hide();
    $('#ViewHRData tbody tr').slice(0, rowsShown).show();
    $('#navigatorData a:first').addClass('active');
    $('#navigatorData a').bind('click', function(){

        $('#navigatorData a').removeClass('active');
        $(this).addClass('active');
        var currPage = $(this).attr('rel');
        var startItem = currPage * rowsShown;
        var endItem = startItem + rowsShown;
        $('#ViewHRData tbody tr').css('opacity','0.0').hide().slice(startItem, endItem).
                css('display','table-row').animate({opacity:1}, 300);
    });
}

// Function that executes query
function executeQuery()
{
  var selectedQuery = document.getElementById("queryToExecute").value;
  var parameters = {};

  if(selectedQuery=="HR"){
    var parameters = {};
    parameters.ssn = document.getElementById("SSN_HR").value;
    parameters.swabDate = document.getElementById("SwabDate_HR").value;
  }
  if(selectedQuery=="SB"){
    var parameters = {};
    parameters.ssn = document.getElementById("SSN_SB").value;
    parameters.date = document.getElementById("Date_SB").value;
    parameters.type = document.getElementById("Type_SB").value;
    parameters.outcome = document.getElementById("Outcome_SB").value;
  }
  console.log(selectedQuery, parameters);
  api.executeQuery(selectedQuery, parameters).then(result => {
    if(selectedQuery=="HR"){
      document.getElementById("bodyTableHRView").innerHTML = "";
      result.forEach(val => {
        //sconsole.log(val);
        document.getElementById("bodyTableHRView").innerHTML += "<tr> \
            <td>"+val.ssn+"</td> \
            <td>"+val.name+"</td> \
            <td>"+val.lastname+"</td> \
            <td>"+val.birth_date.day+"/"+val.birth_date.month+"/"+val.birth_date.year+"</td> \
            <td>"+val.address+"</td> \
            <td>"+val.phone_number+"</td> \
            <td>"+val.email+"</td> \
        </tr>"
      });
      ViewHRPagination();
    }
    else if (selectedQuery == "SB")
      alert(result);
    // I receive a list of persons
    //console.log(result);
  });


}

//Function that show the filling Label based on the combo's choice
function changeShowed(selected){
  if (selected == "HR")
  {
    document.getElementById("InsertSB").style.display = "none";
    document.getElementById("InsertHR").style.display = "";
    document.getElementById("ViewHR").style.display = "";
  }
  else if (selected == "SB")
  {
    document.getElementById("InsertSB").style.display = "";
    document.getElementById("InsertHR").style.display = "none";
    document.getElementById("ViewHR").style.display = "none";
  }
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

      $('.node.person').each(function() {
        var hue = 'rgb(' + (Math.floor((256 - 199) * Math.random()) + 200) + ',' + (Math.floor((256 - 199) * Math.random()) + 200) + ',' + (Math.floor((256 - 199) * Math.random()) + 200) + ')';
        $(this).css("fill", hue);
     });
  });
}
