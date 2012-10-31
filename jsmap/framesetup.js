

function getItOn() {
	// load the real contents
	loadFrames();


	var $cResizer = $('#sq_resizer');
	var $cMain = $('#container_main');


	// start the asset map
	var $assetMap = $('#asset_map')
		.css({
			bottom: '20px',
			overflow: 'auto'
		})
		// hook up resizing
		// see http://bugs.jqueryui.com/ticket/4310
		.resizable({
			handles: {
				e: $cResizer
			},
			// see http://bugs.jqueryui.com/ticket/3176
			// and http://bugs.jqueryui.com/ticket/6004
			start: function (event, ui) {
				var ifr = $('#container_main iframe');
				var d = $('<div></div>');

				$cMain.append(d[0]);
				d[0].id = 'resize_iframe_cover';
				d.css({
					position:'absolute',
					top: ifr.position().top,
					left: 0,
					height: ifr.height(),
					width: '100%'
				});
			},

			stop: function (event, ui) {
				// see http://bugs.jqueryui.com/ticket/3176
				$('#resize_iframe_cover').remove();

				// see http://forum.jquery.com/topic/resizable-ignore-height-change-on-horizontal-resize
				ui.element.css({ height: null });
				$assetMap.css({ height: 'auto' });

				// make sure we finish up with reasonable defaults
				var offset = $cResizer.get(0).offsetLeft;

				$assetMap.css('width', offset - $assetMap.get(0).offsetLeft);
				$cMain.css('left', offset + 10);
			},
			// move the resizer and resize the main frame
			resize: function(event, ui) {
				var pad = 0;
				var offset = ui.position.left + ui.size.width + pad;
				$cResizer.css('left', offset);
				$cMain.css('left', offset + 10);
			}
		})
		.matrixTree();


		// this is effectively a jstree plugin
		// custom dnd_finish to handle opening the context menu
		var dnd_finish = function(e) {
console.log('dnd_finish', arguments);
//console.log('selected', t.data.ui.selected);
//console.log('target', $(e.target).closest('li'));

			var foundSelf = false;
			var t = $.jstree._reference(e.target);
			t.data.ui.selected.each(function() {
				if (this === $(e.target).closest('li').get(0)) {
					foundSelf = true;
					return false;
				}
			});

			if (foundSelf) {
console.log('self drop!');
				// let the original method clean up
//							return this.dnd_finish.old.apply(this, arguments);
				return;
			}

			this.dnd_prepare();

			// grab the info we need now because it's going away real shortly
			sq_assetMap.dnd_info = {
				// TODO check if prepared_move from jstree:105 might be better in dnd_expose
				hidden: this.dnd_expose(),
				data: $.extend({}, this.data.dnd)
			};

			// a chance at making a difference
			$(sq_assetMap.menuSelectors['select']).contextMenu(e);
		};
		// TODO should probably use the prototype instead, and do
		// this before any trees are created
		dnd_finish.old = $.jstree._fn.dnd_finish;
		$.jstree._fn.dnd_finish = dnd_finish;
//								dnd_finish.old = t.dnd_finish;
//								t.dnd_finish = dnd_finish;
//								dnd_finish.old = $.jstree._fn.dnd_finish;
//								$.jstree._fn.dnd_finish = dnd_finish;



	var offsetLeft = $assetMap.get(0).offsetLeft + $assetMap.get(0).offsetWidth;
	$cResizer.css({
		left: offsetLeft
	});
	$cMain.css({
		left: offsetLeft + 10
	});


}



// keep track of which routers are loaded
var loadedRouters = {
//	sq_header: false,
//	sq_sidenav: false,
//	sq_resizer: false,
//	sq_main: false
	sq_override: false
};

// this will be called by all the router frames
function routerLoaded(frameName) {
//console.log('routerLoaded', arguments);
//console.trace();
	if (!loadedRouters.hasOwnProperty(frameName)) {
console.log('Frame loaded that hasn\'t been accounted for in pre-loading of routers', frameName);
console.trace();
		return;
	}

	loadedRouters[frameName] = true;

	if (routersLoaded()) {
		// avoid loading again
		// TODO this is a hack
		loadedRouters = {
			sq_lookin_good: false
		};

		// load the real contents
		loadFrames();

		// start the asset map
		var $assetMap = $('#asset_map')
			.css({
				bottom: '20px',
				overflow: 'auto'
			})
			.matrixTree();

		var offsetLeft = $assetMap.get(0).offsetLeft + $assetMap.get(0).offsetWidth;
		var cResizer = $('#sq_resizer')
			.css({
				left: offsetLeft
			});
		var cMain = $('#container_main')
			.css({
				left: offsetLeft + 10
			});
return;

		// start the jstree
		// this is from git
/*
		$('#jsmap').jstree({
			plugins:[
				'json', // for initial data - see http://www.jstree.com/documentation/json_data
				'crrm', // for dynamic addition - see http://www.jstree.com/documentation/crrm
				'ui', // allows selection - see http://www.jstree.com/documentation/ui
				'themes', // for icons - see http://www.jstree.com/documentation/themes
				'dnd', // for drag/drop - see http://www.jstree.com/documentation/dnd
				'cookies' // for state saving - see http://www.jstree.com/documentation/cookies
			],
			json: {
				data: [
					{
						title: 'root',
						attr: {
							id: 1
						},
						li_attr: {
							assetid: '1'
						}
					}
				]
			}
		});
*/
/*
		$('#jsmap').jstree({
			plugins:[
				'json_data',
				'crrm',
				'ui',
				'themes',
				'dnd'
			],
			json_data: {
				data: [
					{
						data: 'root',
						state: 'closed',
						attr: {
							id: 1,
							assetid: 1
						},
						children: []
					}
				]
			}
		});
		// see http://code.google.com/p/jstree/issues/detail?id=977
		$.jstree._fn.get_rollback = function(){this.__callback();}
*/
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

	// showing main before the header so it can access the sq-search-wait-popup
	// TODO there's still a race condition here
	// we could poll for the sq-search-wait-popup, then load the header...
	top.getFrame('sq_main').location.href = frameInfo['sq_main'];
	top.getFrame('sq_resizer').location.href = frameInfo['sq_resizer'];
	top.getFrame('sq_header').location.href = frameInfo['sq_header'];
}


// a bunch of stuff to get things working
function randomFixing() {
	// see asset_map.inc:502
	// TODO smart height adjustmest via event perhaps?
	var mapHeight = document.body.offsetHeight - mapNegativeOffset;
	var mapWidth = $('#asset_map').get(0).offsetWidth;
	var mapPadding = 12;

	$('#asset_map')
//		.css('height', mapHeight + 'px')
//		.css('bottom', '20px')
		.children().not('[id="jsmap"]')
			.css({
				width: (mapWidth - (mapPadding + 5) * 2) + 'px',
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
