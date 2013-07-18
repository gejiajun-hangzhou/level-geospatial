var ts = require("./tile-system");
var cu = require("./coordinate-utils");
var assert = require("assert");
var stream = require('stream')
var Readable = stream.Readable;

var MaxDetailLevel = 22;

module.exports = function(db){

	function put(lat, lon, id, value, cb){
		var key = encodeLevelKey(lat, lon, id);
		db.put(key, value, cb);
	}

	function search(lat, lon, radius){
		var stream = new Readable({objectMode : true});
		var quadKeys = getSearchRange(lat,lon,radius);
		var openStreams = 0;

		quadKeys.forEach(function(quadKey){

			console.log("http://ak.dynamic.t1.tiles.virtualearth.net/comp/ch/" + quadKey + "?mkt=en-gb&it=G,VE,BX,L,LA&shading=hill&og=18&n=z");

			var options = {}
			options.start = quadKey;
			options.end =  quadKey + "~";
			openStreams++;

			db.createReadStream(options)
			  .on('data', function (data) {

			  	var key = decodeLevelKey(data.key);
			  	var d = cu.distance(lat,lon,key.lat,key.lon);
			  	console.log(data.key);
			  	if (d <= radius){
			  		data.distance = d;
			  		stream.push(data);		
			  	}

			  })
			  .on('end', function () {
			  	openStreams--;
			  	if (openStreams == 0) stream.push(null);
			  });
			stream._read = function(){};

		});

		return stream;
	}


	function searchKey(lat,lon,depth){
		var pixelCoords = ts.latLonToPixelXY(lat,lon,depth);
		var tileCoords = ts.pixelXYToTileXY(pixelCoords.pixelX,pixelCoords.pixelY);
		return ts.tileXYToQuadKey(tileCoords.tileX,tileCoords.tileY,depth);
	}

	function latLonToQuadKey(lat,lon, level){
		var pixelCoords = ts.latLonToPixelXY(lat,lon,level);
		var tileCoords = ts.pixelXYToTileXY(pixelCoords.pixelX,pixelCoords.pixelY);
		return ts.tileXYToQuadKey(tileCoords.tileX,tileCoords.tileY,level);
	}

	function encodeLevelKey(lat,lon, id){
		id = id.replace("~","");
		return latLonToQuadKey(lat,lon, MaxDetailLevel) + "~" + lat + "~" + lon + "~" + id;
	}

	function decodeLevelKey(key){
		var parts = key.split("~");
		return {
			quadKey: parts[0],
			lat: parseFloat(parts[1]),
			lon: parseFloat(parts[2]),
			id: parts[3]
		}
	}

	function getSearchRange(lat, lon, radius){
		var box = cu.boundingRectangle(lat, lon, radius);
		var topLeft = ts.latLonToPixelXY(box.top,box.left,MaxDetailLevel);
		var bottomRight = ts.latLonToPixelXY(box.bottom,box.right,MaxDetailLevel);
		var numberOfTilesAtMaxDepth = Math.floor((bottomRight.pixelX - topLeft.pixelX) / 256);
		var zoomLevelsToRise = Math.floor(Math.log(numberOfTilesAtMaxDepth) / Math.log(2));
		zoomLevelsToRise++;

		var quadDictionary = {};
		quadDictionary[latLonToQuadKey(box.top,box.left,Math.max(0,MaxDetailLevel - zoomLevelsToRise))] = true;
		quadDictionary[latLonToQuadKey(box.top,box.right,Math.max(0,MaxDetailLevel - zoomLevelsToRise))] = true;
		quadDictionary[latLonToQuadKey(box.bottom,box.left,Math.max(0,MaxDetailLevel - zoomLevelsToRise))] = true;
		quadDictionary[latLonToQuadKey(box.bottom,box.right,Math.max(0,MaxDetailLevel - zoomLevelsToRise))] = true;

		var quadList = [];
		for (x in quadDictionary){
			quadList.push(x);
		}

		return quadList;
	}


	return { put:put, search:search };
}




