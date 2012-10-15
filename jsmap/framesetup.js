// keep track of which routers are loaded
var loadedRouters = {
	sq_header: false,
	sq_sidenav: false,
	sq_resizer: false,
	sq_main: false
};

// this will be called by all the router frames
function routerLoaded(frameName) {
//console.log('routerLoaded', arguments);
//console.trace();
	if (!loadedRouters.hasOwnProperty(frameName)) {
console.log('Frame loaded that hasn\'t been accounted for in pre-loading of routers');
		return;
	}

	loadedRouters[frameName] = true;

	if (routersLoaded()) {
		// avoid loading again
		// TODO this is a hack
		loadedRouters = {};

		// load the real contents
		loadFrames();

		// start the asset map
		$('#asset_map').matrixMap();

		randomFixing();
	}
}

// check if all routers are loaded
function routersLoaded() {
	var loaded = true;
	for (var i in loadedRouters) {
		if (!loadedRouters.hasOwnProperty(i)) continue;
		loaded &= loadedRouters[i];
	}

	return loaded;
}

// load the actual contents
function loadFrames() {
	var frameInfo = top.frameUrls;
//console.log(frameInfo);
//	parent.frames['sq_header'].location.replace = frameInfo['sq_header'];
//	frames['sq_resizer'].location.replace = frameInfo['sq_resizer'];
//	frames['sq_main'].location.replace = frameInfo['sq_main'];

	// showing main before the header so it can access the sq-search-wait-popup
	// TODO there's still a race condition here
	// we could poll for the sq-search-wait-popup, then load the header...
	frames['sq_main'].location.href = frameInfo['sq_main'];
	frames['sq_resizer'].location.href = frameInfo['sq_resizer'];
	parent.frames['sq_header'].location.href = frameInfo['sq_header'];
}


// a bunch of stuff to get things working
function randomFixing() {
	// see asset_map.inc:502
	// TODO smart height adjustmest via event perhaps?
	var mapHeight = document.body.offsetHeight - mapNegativeOffset;
	var mapWidth = $('#asset_map').get(0).offsetWidth;
	var mapPadding = 12;

	$('#asset_map')
		.css('height', mapHeight + 'px')
		.children()
			.css({
				width: (mapWidth - mapPadding * 2) + 'px',
				height: (mapHeight - mapPadding * 2) + 'px',
				position: 'absolute'
			});

	// allow messages to work
	// see backend.inc:851
	// TODO race condition here!
	// Uncaught TypeError: Cannot set property 'appendChild' of null
	top.frames['sq_main'].jQuery(function($) {

	top.frames['sq_main'].document.body.appendChild = function() {
console.log('appendChild', arguments);
		return top.frames['sq_sidenav'].frames['sq_main'].document.body.appendChild.apply(top.frames['sq_sidenav'].frames['sq_main'].document.body, arguments);
	};
	top.frames['sq_main'].document.createElement = function() {
console.log('createElement', arguments);
		return top.frames['sq_sidenav'].frames['sq_main'].document.createElement.apply(top.frames['sq_sidenav'].frames['sq_main'].document, arguments);
	};
	top.frames['sq_main'].document.getElementById = function() {
console.log('getElementById', arguments);
		return top.frames['sq_sidenav'].frames['sq_main'].document.getElementById.apply(top.frames['sq_sidenav'].frames['sq_main'].document, arguments);
	};
	});



	// allow showing the results of a successful search
	// capture attempt to unload the page, then redirect the main frame
	var resetFrames = function(evt) {
		// hmm, this seems wrong as this event only happens after the header has reloaded...
//		if (!top.frames['sq_header'].SQ_FORM_SUBMITTED) return;

		// put the router frame back
		top.frames['sq_main'].location = top.frames['sq_sidenav'].jsRouterPath + "sq_main";

		// now go to the place we want to
//		top.frames['sq_sidenav'].frames['sq_main'].location.href = evt.currentTarget.location.href;
		top.frames['sq_sidenav'].frames['sq_main'].location.href = evt.location.href;
	}

	// allow showing the results of a successful search
	// capture attempt to unload the page, then redirect the main frame
//	top.frames['sq_main'].onbeforeunload = function() {
//console.log('leaving frame ' + top.frames['sq_main'].location.href);
//console.log(top.frames['sq_main'].location);
//		top.frames['sq_sidenav'].frames['sq_main'].location = top.frames['sq_main'].event.currentTarget.location;
//		return;
//	}
	top.frames['sq_main'].onunload = function() {
//console.log('leaving frame ' + top.frames['sq_main'].location.href);
////console.log(top.frames['sq_main'].location);
//console.log(top.frames['sq_main'].event.currentTarget);
var evt = top.frames['sq_main'].event.currentTarget;
//		top.frames['sq_sidenav'].frames['sq_main'].location = top.frames['sq_main'].event.currentTarget.location;
setTimeout(function() { resetFrames(evt); }, 500);
		return false;
	}

}
