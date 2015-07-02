(function(window, undefined) {
  'use strict';

  window.MapTools = window.MapTools || {};
  MapTools.version = '0.1.0';

  MapTools.ContourGrid = function(param) {
    var colours = ['#000099','#0000FF','#3399FF','#00CCFF','#00CC00','#66FF00','#FFFF00','#CC0000','#FF6633'];
    var vmax = -9999999999;
    var vmin = 9999999999;

    var _param = param;
    var _gridX = MapTools.Util.arange(_param.startLng, _param.endLng, _param.cellSize);
    var _gridY = MapTools.Util.arange(_param.startLat, _param.endLat, _param.cellSize);
    var _data = [];
    var _zData;
    var _zAggr;

    this.addData = function(d) {
      _data.push(d);
    };

    var _generateContour = function() {
      _zData = _data.map(function(d) { 
        return MapTools.Util.bivariateNormal(_gridX, _gridY, Math.sqrt(d.sigmax), Math.sqrt(d.sigmay), d.mux, d.muy); 
      }); 
      _zAggr = [];
      for (var y=0;y<_gridY.length;y++) {
        _zAggr[y] = [];
        for (var x=0;x<_gridX.length;x++) {
          _zAggr[y][x] = 0.0;
        }
      }
      for (var i=0;i<_zData.length;i++) {
        for (var y=0;y<_gridY.length;y++) {
          for (var x=0;x<_gridX.length;x++) {
            _zAggr[y][x] = _zAggr[y][x] + _zData[i][y][x];
          }
        } 
      }

      for (var y=0;y<_gridY.length;y++) {
        for (var x=0;x<_gridX.length;x++) {
          if (_zAggr[y][x] > vmax) { vmax = _zAggr[y][x]; }
          if (_zAggr[y][x] < vmin) { vmin = _zAggr[y][x]; }
        }
      }

    };

    this.drawTo = function(map) {
      _generateContour();
      var padding = 10;
      var numLevel = colours.length;

      var drawLayer = function() {
        console.time('draw contour');
        d3.select("#overlayCenter").remove();
        d3.select("#overlayRect").remove();

        var cdata = [];
        for (var y=0;y<_gridY.length;y++) {
          for (var x=0;x<_gridX.length;x++) {
            var point = map.latLngToLayerPoint(new L.LatLng( _gridY[y], _gridX[x]));
            var v = Math.round((_zAggr[y][x]-vmin)/(vmax-vmin)*numLevel);
            if (v == 0) continue;
            cdata.push( {x: point.x, y: point.y, val: v} );
          }
        }
        //console.log(cdata.length);

        var bounds = map.getBounds();
        var topLeft = map.latLngToLayerPoint(bounds.getNorthWest());

        var svgCenter = d3.select(map.getPanes().overlayPane).append("svg")
          .attr("id", "overlayCenter")
          .attr("class", "leaflet-zoom-hide")
          .style("width", map.getSize().x + "px")
          .style("height", map.getSize().y + "px")
          .style("margin-left", topLeft.x + "px")
          .style("margin-top", topLeft.y + "px");


        var gCenter = svgCenter.append("g")
          .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

        var svgCenters = gCenter
          .attr("class", "points")
          .selectAll("g")
          .data(_data)
          .enter()
          .append("g")
          .attr("class", "point");

        svgCenters.append("circle")
        .style("fill", '#000')
        .attr("transform", function(d) { 
          var p = map.latLngToLayerPoint(new L.LatLng(d.muy, d.mux));
          return "translate(" + p.x + "," + p.y + ")"; 
        })
        .attr("r", 3);

        var svg = d3.select(map.getPanes().overlayPane).append("svg")
          .attr("opacity",0.4)
          .attr("id", "overlayRect")
          .attr("class", "leaflet-zoom-hide")
          .style("width", map.getSize().x + "px")
          .style("height", map.getSize().y + "px")
          .style("margin-left", topLeft.x + "px")
          .style("margin-top", topLeft.y + "px");

        var gRect = svg.append("g")
          .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

        var svgRects = gRect
          .attr("class", "points")
          .selectAll("g")
          .data(cdata)
          .enter()
          .append("g")
          .attr("class", "point");

        var rectSize = Math.round(cdata[1].x - cdata[0].x);
        // console.log(rectSize);
        svgRects.append("rect")
          .style("fill", function(d) { return colours[d.val-1]; })
          .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
          .attr('width', rectSize)
          .attr('height', rectSize);

        console.timeEnd('draw contour');
      };

      var mapLayer = {
        onAdd: function(m) {
          m.on('viewreset moveend', drawLayer);
          drawLayer();
        }
      };
      map.addLayer(mapLayer);

    }
  };



  MapTools.Util = {
    arange: function (start, end, delta) {
      var arr = [];
      for (var i=start;i<end;i+=delta) {
        arr.push(i);
      }
      return arr;
    },
    // bivariateNormal: function (xarr, yarr, sigmax, sigmay, mux, muy, sigmaxy) {
    //   // this function is taken from matplotlib mlab.py bivariate_normal 
    //   var xMu = xarr.map(function(e) { return e-mux; });
    //   var yMu = yarr.map(function(e) { return e-muy; });
    //   var rho = sigmaxy/ (sigmax*sigmay);
    //   //if (rho*rho > 1) {rho = 0.0;}
    //   var sigmaxSqr = sigmax*sigmax;
    //   var sigmaySqr = sigmay*sigmay;
    //   var z = [];
    //   for (var y=0;y<yarr.length;y++) {
    //     var zx = [];
    //     for (var x=0;x<xarr.length;x++) {
    //       zx[x] = (xMu[x]*xMu[x]) / sigmaxSqr
    //         + (yMu[y]*yMu[y]) / sigmaySqr;
    //         - 2*rho*xMu[x]*yMu[y]/(sigmax*sigmay);
    //     }
    //     z[y] = zx;
    //   }
    //   denom = 2*Math.PI*sigmax*sigmay*Math.sqrt(1-rho*rho);
    //   var result = [];
    //   for (var y=0;y<z.length;y++) {
    //     var res = [];
    //     for (var x=0;x<z[y].length;x++) {
    //       res[x] = Math.exp(-z[y][x]/(2*(1-rho*rho)))/denom;
    //     }
    //     result[y] = res;
    //   }
    //   // console.log(result);
    //   return result;
    // },
    bivariateNormal: function(xarr, yarr, sigmax, sigmay, mux, muy) {
      /*
        Simplified bivariate normal with sigmaxy equals to zero.
        This function is faster than original version by removing unnecessary computation
      */
      var xMuSqr = xarr.map(function(e) { return (e-mux)*(e-mux); });
      var yMuSqr = yarr.map(function(e) { return (e-muy)*(e-muy); });
      var sigmaxSqr = sigmax*sigmax;
      var sigmaySqr = sigmay*sigmay;
      var z = [];
      for (var y=0;y<yarr.length;y++) {
        var zx = [];
        for (var x=0;x<xarr.length;x++) {
          zx[x] = xMuSqr[x] / sigmaxSqr
            + yMuSqr[y] / sigmaySqr;
        }
        z[y] = zx;
      }
      var denom = 2*Math.PI*sigmax*sigmay;
      var result = [];
      for (var y=0;y<z.length;y++) {
        var res = [];
        for (var x=0;x<z[y].length;x++) {
          res[x] = Math.exp(-z[y][x]/2)/denom;
        }
        result[y] = res;
      }
      // console.log(result);
      return result;
    }
  };

}(window));
