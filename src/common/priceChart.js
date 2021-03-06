PriceChart = function (options) {
  var self      = this,
    xScale      = d3.time.scale(),
    priceScale  = d3.scale.linear(),
    volumeScale = d3.scale.linear(),
    xAxis       = d3.svg.axis().scale(xScale),
    volumeAxis  = d3.svg.axis().scale(volumeScale).orient("left").tickFormat(d3.format("s")),
    priceAxis   = d3.svg.axis().scale(priceScale).orient("right"),
    apiHandler  = new ApiHandler(options.url),
    liveFeed, isLoading;
    
  self.type = options.type ? options.type : "line";  //default to line  	
  
  var div = d3.select(options.id).attr("class","priceChart"),
    svg, svgEnter, gEnter, gradient, 
    hover, horizontal, focus, 
    status, details, loader;
    
  if (!options.margin) options.margin = {top: 2, right: 60, bottom: 20, left: 60};
  if (!options.width)  options.width  = parseInt(div.style('width'), 10) - options.margin.left - options.margin.right;
  if (!options.height) options.height = options.width/2>400 ? options.width/2 : 400;
 
  function drawChart() {
    div.html("");
    svg = div.selectAll("svg").data([0])
    svgEnter = svg.enter().append("svg")
      .attr("width", options.width + options.margin.left + options.margin.right)
      .attr("height", options.height + options.margin.top + options.margin.bottom);   
  
    svg.append("defs").append("clipPath").attr("id", "clip").append("rect");
    svg.select("rect").attr("width", options.width).attr("height", options.height);
  
    gEnter = svg.append("g")
      .attr("transform", "translate(" + options.margin.left + "," + options.margin.top + ")");
    gEnter.append("rect").attr("class", "background").attr("width", options.width).attr("height", options.height);
    gEnter.append("g").attr("class", "volumeBars").attr("clip-path", "url(#clip)");   
    gEnter.append("g").attr("class", "candlesticks").attr("clip-path", "url(#clip)");
    gEnter.append("path").attr("class", "line");
    gEnter.append("g").attr("class", "x axis");
  
    gEnter.append("g").attr("class", "volume axis")   
      .append("text").text("Volume")
      .attr("class", "title")
      .attr("transform", "rotate(-90)")
      .attr("y",15).attr("x",-110);
  
    gEnter.append("g").attr("class", "price axis")
      .attr("transform", "translate("+options.width+", 0)")
      .append("text").text("Price")
        .attr("class", "title")
        .attr("transform", "rotate(-90)")
        .attr("y",-10).attr("x",-100);
          
    // gradient for volume bars	    
    gradient = svg.append("svg:defs")
      .append("svg:linearGradient")
      .attr("id", "gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%")
      .attr("spreadMethod", "pad");
  
    gradient.append("svg:stop")
      .attr("offset", "0%")
      .attr("stop-color", "#ccc")
      .attr("stop-opacity", 0.5);
  
    gradient.append("svg:stop")
      .attr("offset", "100%")
      .attr("stop-color", "#ddd")
      .attr("stop-opacity", 0.5);	
  
    hover       = gEnter.append("line").attr("class", "hover").attr("y2", options.height);
    horizontal  = gEnter.append("line").attr("class", "hover");
    focus       = gEnter.append("circle").attr("class", "focus dark").attr("r",3);
    status      = div.append("h4").attr("class", "status");
  
    details = div.append("div")   
      .attr("class", "chartDetails")   
      .style("left", options.margin.left+"px")
      .style("right", options.margin.right+"px")            
      .style("opacity", 0);      
  
    loader = div.append("img")
      .attr("class", "loader")
      .attr("src", "assets/images/rippleThrobber.png")
      .style("opacity", 0);	
      
    if (isLoading) {
      svg.style("opacity", 0.5);
      loader.style("opacity", 1);
    }
  }
  
  function resizeChart () {
    old = options.width;
    w = parseInt(div.style('width'), 10);
    options.width  = w-options.margin.left - options.margin.right;
    options.height = options.width/2>400 ? options.width/2 : 400;
    
    if (old != options.width) {
      drawChart(); 
      drawData();  
    } 
  }
  
  drawChart();
  if (options.resize && typeof addResizeListener === 'function') {
    addResizeListener(window, resizeChart);
  } else {
    var padding = parseInt(details.style('padding-left'), 10)+parseInt(details.style('padding-right'), 10);
    details.style("width", (options.width-padding)+"px").style("right","auto");
  }
    
  //fade to throber when reloading from history
  this.fadeOut = function () {
    div.selectAll("svg").transition().duration(100).style("opacity", 0.5);
    svg.on("mousemove.hover", "");
    details.style("opacity", 0);
    status.style("opacity", 0);
    div.selectAll(".hover").style("opacity", 0);
    div.selectAll(".focus").style("opacity", 0);	
    loader.transition().duration(100).style("opacity",1);	
  }

    //set to line or candlestick  	
  this.setType = function (type) {
    self.type = type;

    if (self.type == 'line') {
      gEnter.select(".line").style("opacity",1); 
      gEnter.select(".candlesticks").style("opacity",0);				
    } else {
      gEnter.select(".line").style("opacity",0); 
      gEnter.select(".candlesticks").style("opacity",1);	
    }
  };

  //load historical from API  	  	      			
  this.load = function (base, trade, d) {

    
    self.fadeOut();
    self.base     = base;
    self.trade    = trade;
    self.interval = d.interval;
    self.end      = moment();
    self.multiple = d.multiple;
    self.lineData = [];
    isLoading     = true;
    
    if      (self.interval=="second") self.seconds = 1;
    else if (self.interval=="minute") self.seconds = 60;
    else if (self.interval=="hour")   self.seconds = 60*60;
    else if (self.interval=="day")    self.seconds = 60*60*24;
    else if (self.interval=="week")   self.seconds = 60*60*24*7;
    else if (self.interval=="month")  self.seconds = 60*60*24*30.5; //approx
    else {
      //TODO: unacceptable!
      self.seconds = 60*60;
    }
    
    self.seconds *= self.multiple;  
    self.last     = getAlignedCandle();
    self.end      = moment(self.last).add('seconds', self.seconds);
    self.start    = moment.utc(d.offset(self.end));
     
    //console.log(moment.utc().format("HH:mm:ss")); 
    //console.log(self.last.format("HH:mm:ss")); 
    //console.log(self.end.format("HH:mm:ss")); 
    
    if (liveFeed) liveFeed.stopListener();
    setLiveFeed();
    
    if (self.request) self.request.abort();
    self.request = apiHandler.offersExercised({
      startTime     : self.start.toDate(),
      endTime       : self.end.toDate(),
      timeIncrement : d.interval,
      timeMultiple  : d.multiple,
      descending    : false,
      base          : base,
      trade         : trade
    }, function(data){
      
      //if we've got live data reported already, we need to merge
      //the first live data with the last historic candle
      if (self.lineData.length && data.length) {
        var first  = self.lineData.shift();
        var candle = data[data.length-1];
        var volume = candle.volume + first.volume;
        //candle.open will be from historic
        //vwap should be recalculated?
        if (candle.high>first.high) candle.high = first.high;
        if (candle.low<first.low)   candle.low  = first.low;
        candle.vwap   = (candle.vwap*candle.volume+first.vwap*first.volume)/volume;
        candle.volume = volume;
        candle.close  = first.close;
        data[data.length-1] = candle;
      }
      
      self.lineData = data.concat(self.lineData);
      isLoading     = false;
      
      drawData();
      
    }, function (error){
      
      isLoading = false;
      console.log(error);
      setStatus(error.text ? error.text : "Unable to load data");
    });     
  }
  
  function setStatus (string) {
    status.html(string).style("opacity",1); 
    if (string) loader.transition().duration(10).style("opacity",0);

  }

  function setLiveFeed () {
    var candle = {
        time   : self.last,
        volume : 0,
        vwap   : 0,
        close  : 0,
        open   : 0,
        high   : 0,
        low    : 0
      };
      
    var viewOptions = {
      base  : self.base,
      trade : self.trade,
      timeIncrement    : self.interval,
      timeMultiple     : self.multiple,
      incompleteApiRow : candle
    }
    
    if (liveFeed) liveFeed.updateViewOpts(viewOptions);
    else liveFeed = new OffersExercisedListener (viewOptions, liveUpdate);    
  }
  
  this.suspend = function () {
    if (liveFeed) liveFeed.stopListener();
    if (options.resize && typeof removeResizeListener === 'function')
      removeResizeListener(window, resizeChart);   
  }
  
  function liveUpdate (data) {

    var first = self.lineData.length ? self.lineData[0] : null;
    var last  = self.lineData.length ? self.lineData[self.lineData.length-1] : null;
    var candle = {
        time   : moment.utc(data.openTime),
        volume : data.baseCurrVol,
        vwap   : data.vwavPrice,
        close  : data.closePrice,
        open   : data.openPrice,
        high   : data.highPrice,
        low    : data.lowPrice,
        live   : true
      }; 
      
    //if (last) console.log("last:", last.time.local().format("HH:mm:ss"));
    //console.log("time:", candle.time.local().format("HH:mm:ss"));
    //console.log(data.closePrice, data.baseCurrVol);
    
    if (last && candle.volume && last.time.unix()===candle.time.unix()) {
      //console.log('replace');
      if (!last.live) {  //historical data
        var volume = candle.volume + last.volume;
        if (candle.high<last.high) candle.high = last.high;
        if (candle.low>last.low)   candle.low  = last.low;
        candle.vwap   = (candle.vwap*candle.volume+last.vwap*last.volume)/volume;
        candle.volume = volume;
        candle.open   = last.open;
        //close will be from live data
        data[data.length-1] = candle;
        
      }
      self.lineData[self.lineData.length-1] = candle;
    } else {
      
      //new candle, only add it if something happened
      if (candle.volume) {
        //console.log('append');
        //console.log(candle);
        self.lineData.push(candle); //append the candle    
      }
      //adjust the range  
      self.start.add(self.seconds,"seconds");
      self.end.add(self.seconds,"seconds");
    
      //remove the first candle if it is before the start range
      if (first && first.time.unix()<self.start.unix()) self.lineData.shift();
    }
    
    //redraw the chart
    if (self.lineData.length) drawData();
  }
  
  function drawData () {	
    if (!isLoading && (!self.lineData || !self.lineData.length)) {
      setStatus("No Data for this Period");
    } else setStatus("");

    if (self.type == 'line') {
      gEnter.select(".line").style("opacity",1); 
      gEnter.select(".candlesticks").style("opacity",0);				
    } else {
      gEnter.select(".line").style("opacity",0); 
      gEnter.select(".candlesticks").style("opacity",1);	
    }

    var line = d3.svg.line()
      .x(function(d) { return xScale(d.time); })
      .y(function(d) { return priceScale(d.close); });
    
    var num = (moment(self.end).unix() - moment(self.start).unix())/self.seconds;
    
    //console.log(num); //aiming for around 100-200 here
    
    var candleWidth = options.width/(num*1.3);
    if (candleWidth<3) candleWidth = 3; 

    svg.datum(self.lineData).on("mousemove.hover", mousemove);

    gEnter.select(".axis.price").select("text").text("Price ("+self.trade.currency+")");
    gEnter.select(".axis.volume").select("text").text("Volume ("+self.base.currency+")");
    var bars = gEnter.select(".volumeBars").selectAll("rect").data(self.lineData);
    bars.enter().append("rect"); 

    // add the candlesticks.
    var candle = gEnter.select(".candlesticks").selectAll("g").data(self.lineData);
    var candleEnter = candle.enter().append("g")
      .attr("transform", function(d) { return "translate(" + xScale(d.time) + ")"; });
    candleEnter.append("line").attr("class","extent");
    candleEnter.append("line").attr("class", "high");
    candleEnter.append("line").attr("class", "low");    
    candleEnter.append("rect");	
        
    // Update the x-scale.
    xScale
      .domain([self.start, self.end])
      .range([0, options.width]);
    
    // Update the volume scale.
    volumeScale
      .domain([0, d3.max(self.lineData, function (d) {return d.volume})*2])
      .range([options.height, 0]);

    // Update the y-scale.
    priceScale
      .domain([
        d3.min(self.lineData, function(d) { return Math.min(d.open, d.close, d.high, d.low); })*0.975,
        d3.max(self.lineData, function(d) { return Math.max(d.open, d.close, d.high, d.low); })*1.025])
      .range([options.height, 0]);

    //add the price line
    gEnter.select(".line").datum(self.lineData).transition().attr("d", line);	

    //add the volume bars
    bars.data(self.lineData)
      .transition()
      .attr("x", function(d){return xScale(d.time)-candleWidth/3})
      .attr("y", function(d){return volumeScale(d.volume)})
      .attr("width", candleWidth/1.2)
      .attr("height", function(d){return options.height - volumeScale(d.volume)})
      .style("fill", "url(#gradient)")
        
    bars.exit().remove();

     /*
         * Candlestick rules: 
         * previous.close < current.close = up/green
         * previous.close > current.close = down/red
         * current.close<current.open = filled
         * current.close>current.open = hollow
     */
                    
    var candleUpdate = candle.classed("up", function(d, i) { 
      if (i>0) {
        var prev = self.lineData[i-1];
        return prev.close<=d.close;
      }
          
      return d.open <= d.close; //just for the first, accurate most of the time
      }).classed("filled", function (d){
         return d.close<=d.open; 
      })
      .transition()
      .attr("transform", function(d) { return "translate(" + xScale(d.time) + ")"; });
        
    candleUpdate.select(".extent")
      .attr("y1", function(d) { return priceScale(d.low); })
      .attr("y2", function(d) { return priceScale(d.high); });
    candleUpdate.select("rect")
      .attr("x", -candleWidth / 2)
      .attr("width", candleWidth)
      .attr("y", function(d) { return priceScale(Math.max(d.open, d.close)); })
      .attr("height", function(d) { return Math.abs(priceScale(d.open) - priceScale(d.close))+0.5; });
    candleUpdate.select(".high")
      .attr("x1", -candleWidth / 4)
      .attr("x2", candleWidth / 4)
      .attr("y1", function(d) { return priceScale(d.high)})
      .attr("y2", function(d) { return priceScale(d.high)});
    candleUpdate.select(".low")
      .attr("x1", -candleWidth / 4)
      .attr("x2", candleWidth / 4)
      .attr("y1", function(d) { return priceScale(d.low)})
      .attr("y2", function(d) { return priceScale(d.low)});
    d3.transition(candle.exit())
      .attr("transform", function(d) { return "translate(" + xScale(d.time) + ")"; })
      .style("opacity", 1e-6).remove();

    // Update the x-axis.
    gEnter.select(".x.axis").call(xAxis).attr("transform", "translate(0," + priceScale.range()[0] + ")")

    // Update the y-axis.
    gEnter.select(".price.axis").call(priceAxis).attr("transform", "translate(" + xScale.range()[1] + ", 0)")

    // Update the left axis.
    gEnter.select(".volume.axis").call(volumeAxis);

    //hide the loader, show the chart
    if (!isLoading) {
      svg.transition().duration(300).style("opacity", 1);
      loader.transition().duration(300).style("opacity", 0);
    }

  }

  function mousemove() {
    var tx = Math.max(0, Math.min(options.width+options.margin.left, d3.mouse(this)[0])),
      x    = d3.bisect(self.lineData.map(function(d) { return d.time }), xScale.invert(tx-options.margin.left)),
      d    = self.lineData[x],
      o, h, l, c, v;

    if (d) {
      
      if (ripple && ripple.Amount) {
        o = ripple.Amount.from_human(d.open).to_human({max_sig_digits:4});
        h = ripple.Amount.from_human(d.high).to_human({max_sig_digits:4});
        l = ripple.Amount.from_human(d.low).to_human({max_sig_digits:4});
        c = ripple.Amount.from_human(d.close).to_human({max_sig_digits:4});
        v = ripple.Amount.from_human(d.volume).to_human({max_sig_digits:0}); 
      } else {
        o = d.open.toFixed(4);
        h = d.high.toFixed(4);
        l = d.low.toFixed(4);
        c = d.close.toFixed(4);
        v = d.volume.toFixed(0);
      }

      var details = div.select('.chartDetails');
      details.html("<span class='date'>"+ parseDate(d.time.local(), self.interval) + 
        "</span><span>O:<b>" + o  + "</b></span>" +
        "<span class='high'>H:<b>" + h + "</b></span>" +
        "<span class='low'>L:<b>" + l + "</b></span>" +
        "<span>C:<b>" + c  + "</b></span>" +
        "<span class='volume'>Volume:<b>" + v + " " + self.base.currency + "</b></span>")
        .style("opacity",1);

      hover.transition().duration(50).attr("transform", "translate(" + xScale(d.time) + ")");
      focus.transition().duration(50).attr("transform", "translate(" + xScale(d.time) + "," + priceScale(d.close) + ")");
      horizontal.transition().duration(50)
        .attr("x1", xScale(d.time))
        .attr("x2", options.width)
        .attr("y1", priceScale(d.close))
        .attr("y2", priceScale(d.close));

      hover.style("opacity",1);
      horizontal.style("opacity",1);
      focus.style("opacity",1);
    }
  }

  function getAlignedCandle() {
    var now = moment().utc(), aligned;
    now.subtract("milliseconds", now.milliseconds());
     
    if (self.interval=='second') {
      aligned = now.subtract("seconds", now.seconds()%self.multiple);
      
    } else if (self.interval=='minute') {
      aligned = now.subtract({
        seconds : now.seconds(), 
        minutes : now.minutes()%self.multiple
      });
            
    } else if (self.interval=='hour') {
      aligned = now.subtract({
        seconds : now.seconds(), 
        minutes : now.minutes(),
        hours   : now.hours()%self.multiple
      });   
             
    } else if (self.interval=='day') {
      aligned = now.subtract({
        seconds : now.seconds(), 
        minutes : now.minutes(),
        hours   : now.hours(),
        days    : now.dayOfYear()%self.multiple
      }); 

    } else if (self.interval=='week') {
      aligned = now.subtract({
        seconds : now.seconds(), 
        minutes : now.minutes(),
        hours   : now.hours(),
        days    : now.day(),
        weeks   : now.isoWeek()%self.multiple
      }); 
      
    } else if (self.interval=='month') {
      aligned = now.subtract({
        seconds : now.seconds(), 
        minutes : now.minutes(),
        hours   : now.hours(),
        days    : now.date()-1,
        months  : now.months()%self.multiple
      }); 
    } 
      
    return aligned;  
  }
  
  function parseDate (date, increment) {
    var monthNames = [ "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December" ];
    
    
    if      (increment == "month") return monthNames[date.month()] + " " + date.year();
    else if (increment == "day")   return monthNames[date.month()] + " " + date.date();
    else if (increment == "hour")  return monthNames[date.month()] + " " + date.date() + " &middot " + date.format("hh:mm A");
    else return monthNames[date.month()] + " " + date.date() + " &middot " + date.format("hh:mm:ss A");
  }
}
