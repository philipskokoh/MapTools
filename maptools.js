(function(window, undefined) {
  'use strict';

  window.MapTools = window.MapTools || {};
  MapTools.version = '0.2.0';

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

    var _mapLayer;
    var _isViewReset;

    this.addData = function(d) {
      if (!d.weight) d.weight = 1;
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
            _zAggr[y][x] = _zAggr[y][x] + _zData[i][y][x]*_data[i].weight;
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
      var container = L.DomUtil.create('div')
      container.setAttribute('id', _param.id);
      map.getPanes().overlayPane.appendChild(container);

      var drawLayer = function() {
        if (d3.select('#' + _param.id).style('opacity') == 0) {
          _isViewReset = true;
          return;
        }
        console.time('draw contour');
        d3.select('#' + _param.id + '> .overlayCenter').remove();
        d3.select('#' + _param.id + '> .overlayRect').remove();

        var cdata = [];
        var rectSize = map.latLngToLayerPoint(new L.LatLng( _gridY[0], _gridX[1])).x 
          - map.latLngToLayerPoint(new L.LatLng( _gridY[0], _gridX[0])).x;
        for (var y=0;y<_gridY.length;y++) {
          var isScanning = false;
          var curVal = 0;
          var sline = null;
          var prevX = null;
          for (var x=0;x<_gridX.length;x++) {
            var v = Math.round((_zAggr[y][x]-vmin)/(vmax-vmin)*numLevel);
            if (v == 0) {
              if (isScanning) {
                cdata.push(sline);
                isScanning = false;
              }
              continue;
            }
            if (isScanning) {
              if (v == sline.val) {
                var point = map.latLngToLayerPoint(new L.LatLng( _gridY[y], _gridX[x]));
                sline.width = sline.width + (point.x - prevX);
                prevX = point.x;
              } else {
                cdata.push(sline);
                var point = map.latLngToLayerPoint(new L.LatLng( _gridY[y], _gridX[x]));
                sline = {
                  x: point.x,
                  y: point.y,
                  val: v,
                  width: rectSize,
                  height: rectSize
                };
                prevX = point.x;
              }
            } else {
              var point = map.latLngToLayerPoint(new L.LatLng( _gridY[y], _gridX[x]));
              sline = {
                x: point.x,
                y: point.y,
                val: v,
                width: rectSize,
                height: rectSize
              };
              prevX = point.x
              isScanning = true;
            }
          }
        }
        //console.log(cdata.length);

        var bounds = map.getBounds();
        var topLeft = map.latLngToLayerPoint(bounds.getNorthWest());

        var tooltip = d3.select('#' + _param.id).append("div")
          .attr('class', 'map-tooltip')
          .style('opacity', 0);

        var svg = d3.select('#' + _param.id).append("svg")
          .attr("opacity",0.6)
          .attr("class", "overlayRect leaflet-zoom-hide")
          .style("width", map.getSize().x + "px")
          .style("height", map.getSize().y + "px")
          .style("margin-left", topLeft.x + "px")
          .style("margin-top", topLeft.y + "px");

        var gRect = svg.append("g")
          .attr("transform", "translate(" + (-topLeft.x) + "," + (-topLeft.y) + ")");

        var svgRects = gRect
          .attr("class", "grid")
          .selectAll("g")
          .data(cdata)
          .enter()
          .append("g")
          .attr("class", "cell");

        svgRects.append("rect")
          .style("fill", function(d) { return colours[d.val-1]; })
          .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
          .attr('width', function(d) { return d.width; })
          .attr('height', function(d) { return d.height; });

        var svgCenter = d3.select('#' + _param.id).append("svg")
          .attr("class", "overlayCenter leaflet-zoom-hide")
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
        .attr('id', function(d) { return d.id; })
        .style("fill", '#000')
        .attr("transform", function(d) { 
          var p = map.latLngToLayerPoint(new L.LatLng(d.muy, d.mux));
          return "translate(" + p.x + "," + p.y + ")"; 
        })
        .attr("r", 3)
        .on('mouseover', function(d) {
          tooltip.transition()
            .duration(500)
            .style('opacity', .9);
          tooltip.html('<p>' + d.id + '</p>')
            .style("left", (d3.event.pageX)-30 + "px")
            .style("top", (d3.event.pageY - 30) + "px"); 
        })
        .on('mouseout', function(d) {
          tooltip.transition()
            .duration(500)
            .style('opacity', 0);
        });

        console.timeEnd('draw contour');
        _isViewReset = false;
      };

      _mapLayer = {
        onAdd: function(m) {
          m.on('viewreset moveend', drawLayer);
          drawLayer();
        },
        hide: function() {
          d3.selectAll('#' + _param.id)
            .style('opacity', 0);
        },
        show: function() {
          d3.selectAll('#' + _param.id)
            .style('opacity', 1);
          if (_isViewReset) {
            drawLayer();
          }
        }
      };
      map.addLayer(_mapLayer);
    };

    this.hide = function() {
      _mapLayer.hide();
    };

    this.show = function(map) {
      _mapLayer.show();
    };

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
