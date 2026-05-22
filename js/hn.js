function convert_to_algolia_query (q) {
  var api_url = "http://hn.algolia.com/api/v1/search_by_date?tags=story"
  var query = ""
  var match = q.match(/^((\w+):)?(.*)$/)
  var type  = match[2]
  var topic = match[3]

  if (type == "domain") {
    query += "&restrictSearchableAttributes=url" + "&query=" + topic
  } else if (type == "points") {
    query += "&numericFilters=" + type + topic
  } else {
    query += "&query=" + topic
  }
  return api_url + query + "&hitsPerPage=30";
}

// default layout
var layout = [
  {title: "Show HN", query: "\"Show HN\"" },
  {title: "GitHub", query: "domain:github.com" },
  {title: "Ruby, Rails", query: "ruby rails" },
  {title: "JRuby", query: "jruby" },
  {title: "Mac OSX", query: "os x" },
  {title: "Java", query: "java scala" },
  {title: "Crowd funding", query: "domain:kickstarter.com" },
  {title: "Javascript", query: "javascript js coffeescript" },
  {title: "Sublime Text", query: "\"Sublime Text\"" },
  {title: "Devops", query: "devops" },
  {title: "Docker", query: "docker" },
  {title: "Stack Exchange", query: "domain:stackoverflow.com" },
  {title: "Google Play Store", query: "domain:play.google.com" },
  {title: "Wikipedia", query: "domain:en.wikipedia.org" },
  {title: "iTunes", query: "domain:itunes.apple.com" },
  {title: "Python", query: "python" },
  {title: "50+ points", query: "points:>50" },
  {title: "100+ points", query: "points:>100" },
  {title: "Reddit", query: "domain:reddit.com" },
  {title: "Stack Overflow", query: "domain:stackoverflow.com" },
  {title: "Superuser", query: "domain:superuser.com" }
];

// check if layout is already in localStorage
if (!('layout' in localStorage)) {
  localStorage['layout'] = JSON.stringify(layout);
} else {
  layout = JSON.parse(localStorage['layout']);
}

// initialize 'seen' array for storing last seen ids
var seen = {};
if(!('seen' in localStorage)) {
  localStorage['seen'] = JSON.stringify(seen);
} else {
  seen = JSON.parse(localStorage['seen']);
}

// setup new window toggle
var newWindow = false;
if(!('newWindow' in localStorage)) {
  localStorage['newWindow'] = JSON.stringify(newWindow);
} else {
  newWindow = JSON.parse(localStorage['newWindow']);
}
$('.toggle-newwindow').prop('checked', newWindow);
$('.toggle-newwindow').change(function(e) {
  newWindow = newWindow ? false : true;
  localStorage['newWindow'] = JSON.stringify(newWindow);
  if(newWindow) {
    $('.hnitems a').attr('target', '_blank');
  } else {
    $('.hnitems a').removeAttr('target');
  }
});
$('.toggle-theme').prop('checked', darkTheme);
$('.toggle-theme').change(function(e) {
  darkTheme = darkTheme ? false : true;
  localStorage['darkTheme'] = JSON.stringify(darkTheme);
  if(darkTheme) {
    $('body').addClass('skimdark');
  } else {
    $('body').removeClass('skimdark');
  }
});

var raw = $('<div class="row"></div>');
// add layout items to dom
for (var i = 0; i < layout.length; i++) {
  var span = $('<div class="span6"><h4 class="hncat"></h4><ul class="hnitems"></ul></div>');
  $('h4.hncat', span).text(layout[i].title).append(' <small><a class="hnedit muted" href="#edit" data-index="'+i+'">/edit</a></small>');
  $('ul.hnitems', span).attr('data-query', layout[i].query);

  raw.append(span);
  // 2 columns in raw
  if (i%2 == 1 || i == layout.length-1) {
    $('#main').append(raw);
    raw = $('<div class="row"></div>');
  };
};
$('a.hnedit').click(function(e){
  e.preventDefault();
  var i = $(this).attr('data-index');
  $('#edit #cattitle').val(layout[i].title);
  $('#edit #catquery').val(layout[i].query);
  $('#edit #catindex').val(i);
  $('#edit').modal('show');
});
$('#edit button.btn-primary').click(function(e){
  var i = $('#edit #catindex').val();
  layout[i].title = $('#edit #cattitle').val();
  layout[i].query = $('#edit #catquery').val();
  localStorage['layout'] = JSON.stringify(layout);
  $('#edit').modal('hide');
  window.location.reload(false);
});
$('#edit button.btn-danger').click(function(e){
  var i = $('#edit #catindex').val();
  layout.splice(i,1);
  localStorage['layout'] = JSON.stringify(layout);
  $('#edit').modal('hide');
  window.location.reload(false);
});
$('#add button.btn-primary').click(function(e){
  layout.push({title: $('#add #cattitle').val(), query: $('#add #catquery').val()});
  localStorage['layout'] = JSON.stringify(layout);
  $('#edit').modal('hide');
  window.location.reload(false);
});

// process layout
$('ul.hnitems').each(function(){
  var ul = $(this);
  data_url = convert_to_algolia_query($(this).attr('data-query'));
  $.ajax({
    url: data_url,
    type: 'GET',
    success: function(data) {
      var query = ul.attr('data-query');
      if (!(query in seen)) {
        seen[query] = data.hits[0].objectID;
      };
      for (var i = 0; i < data.hits.length; i++) {
        var li = $('<li><span class="hnnew"></span><a class="hnscore muted"></a> <a class="hntitle"></a></li>');
        if (data.hits[i].objectID > seen[query]) {
          $('span.hnnew', li).text('+ ');
        }
        $('a.hnscore', li).text(''+data.hits[i].points+'/'+data.hits[i].num_comments+'').attr('href', 'http://news.ycombinator.com/item?id='+data.hits[i].objectID);
        $('a.hntitle', li).text(data.hits[i].title).attr('title', data.hits[i].title).attr('href', data.hits[i].url ? data.hits[i].url : 'http://news.ycombinator.com/item?id='+data.hits[i].objectID);
        if (newWindow) {
          $('a', li).attr('target', '_blank');
        }
        $(ul).append(li);
      };
      seen[query] = data.hits[0].objectID;
      localStorage['seen'] = JSON.stringify(seen);
    }
  })
});
