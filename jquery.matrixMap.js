/**
* MySource Matrix Simple Edit Tools (jquery.matrixMap.js)
* version: 0.1.1 (DEC-16-2009)
* Copyright (C) 2009 Nicholas Hubbard
* @requires jQuery v1.3 or later
*
* Examples and documentation at: http://www.zedsaid.com/projects/simple-edit-tools
* Dual licensed under the MIT and GPL licenses:
* http://www.opensource.org/licenses/mit-license.php
* http://www.gnu.org/licenses/gpl.html
*
*/

/*
Limitations:
	use me - the context menu we've chosen only allows one trigger, so we've
		used two context maps to be triggered by different means

*/


(function ($) {

// constants
STATUS_CONSTRUCTION = '2';
STATUS_LIVE = '16';

// modes
MODE_NORMAL = 1;
MODE_MOVE = 2;
MODE_CLONE = 3;
MODE_LINK = 4;
MODE_SELECT = 5;
MODE_USEME = 6;


$(document).ready(function() {

	// commonly used for context menus
	$.extend($.contextMenu.defaults, {
		events: {
			show: function(options) {
console.log('show.this', this);
console.log('show.args', arguments);
				// store the node that was clicked
				options.target = this.closest('li');
			},
			hide: function(options) {
				// this is called in addition to the command callback
				// so in the command callback we unset the target to
				// indicate our work is done, otherwise we want to keep the
				// mode the same
				if (!options.target) {
console.log('context hide changing map mode');
					$map.mode.change(1);
				}
			}
		}
	});

	// context menu for move/link/clone
	$.contextMenu({
		selector: $map.selector + ' .asset_hold',
		trigger: 'left',
		events: {
			hide: $.noop // override the default above
		},
		items: {
			move: {
				name: 'Move here',
				callback: function(key, options) {
					if (!options.target) {
						alert('Bad state - no target!');
					}
					if (!$map.selected.length) {
						alert('Bad state - nothing selected!');
					}

					$matrix.backend.moveAssets($map.selected, options.target);
				}
			},
			newlink: {
				name: 'New link here',
				disabled: true,
				callback: function(key, options) {
				}
			},
			clone: {
				name: 'Clone here',
				disabled: true,
				callback: function(key, options) {
				}
			},
			sepl: '------',
			cancel: {
				name: 'Cancel',
				callback: function(key, options) {
					$map.mode.change(1);
				}
			}
		}
	});


	// context menu for useme via left click
	$.contextMenu({
		// TODO need to allow expansion when this is active
		selector: $map.selector + ' li',
		trigger: 'left',
		events: {
			show: function(options) { // override the default above
				// store the node that was clicked
				options.target = this;
			}
		},
		items: {
			useme: {
				name: 'Use me',
				callback: function(key, options) {
					if (!options.target) {
						alert('Bad state - no target!');
					}

console.log('target', options.target);
					$map.mode.change(1);
//					$matrix.backend.moveAssets($map.selected, options.target);
				}
			}
		}
	});


	// context menu for useme via left click
	$.contextMenu({
		// TODO need to allow expansion when this is active
		selector: $map.selector + ' a.asset_name',
		trigger: 'left',
		items: {
			useme: {
				name: 'Use me',
				callback: function(key, options) {
					if (!options.target) {
						alert('Bad state - no target!');
					}

console.log('target', options.target);
					delete(options.target);

					// TODO finish the useme
				}
			}
		}
	});
});

/*
var selectMenu = function selectMenu() {
	// TODO work out the location to show this bad boy

}
*/

// Find out what site we are at
/*
var proto = location.protocol;
var site = location.host;
var host_url = proto + '//' + site + '?SQ_ACTION=asset_map_request';
*/
$.fn.matrix = {
	map: {
		selector: '#map_root',
		mode: {
			current: MODE_NORMAL,
			change: function(newMode) {
				if (!$map.mode[newMode]) {
					alert('Invalid map mode requested: ' + newMode);
					return;
				}

				$map.mode[$map.mode.current].exit.call(this);
				$map.mode.current = newMode;
				$map.mode[$map.mode.current].enter.call(this);
			}
		},
		selected: [],
		previousSelected: [],
		// called when selecting something in the map
		select: function() {
			// Remove all colors first
			$($map.selector + ' li a').removeClass('live construction');

			// Set our color when clicked
			attr_stat = $(this).attr('status');

			switch (attr_stat) {
				case STATUS_LIVE:
					$(this).addClass('live');
				break;
				case STATUS_CONSTRUCTION:
					$(this).addClass('construction');
				break;
				default:
				break;
			}
		}
	},
	backend: {
		// TODO work out our path better
		url: location.protocol + '//' + location.host,
		params: {
			SQ_ACTION: 'asset_map_request',
			XDEBUG_SESSION_START: 'netbeans-xdebug'
		},
		getUrl: function getUrl(path, params) {
			return $matrix.backend.url + (path || '') + '?' + $.param($.extend(
				{},
				$matrix.backend.params,
				params || {}
			))
		},
		moveAssets: function(assets, target) {
console.log('target', target);
console.log('selected', $map.selected[0]);
			var args = $.map(assets, function(asset) {
				var info = asset.find('a.asset_name');
				return {
					assetid: info.attr('assetid'),
					linkid: info.attr('linkid'),
					parentid: info.attr('parentid')
				};
			});

			$map.mode.change(1);

			$.ajax({
				url: $matrix.backend.getUrl('/_admin/'),
				type: 'POST',
				processData: false,
				data: $matrix.util.getCommandXML('move asset', {
					to_parent_assetid: target.find('a.asset_name').attr('assetid'),
					to_parent_pos: 0
				}, args),
				contentType: "text/xml",
				dataType: 'xml',
				error: function (XMLHttpRequest, textStatus, errorThrown) {
					console.log(XMLHttpRequest + textStatus + errorThrown);
				},
				success: function(xml) {
					var url = $(xml).find('url[js_function=asset_map_popup]').text();
					url && open_hipo(url);
				}
			});
		}
	}
};

$matrix = $.fn.matrix;
$map = $matrix.map;

// attach mode handlers here because JS doesn't evaluate the LHS of an object property
$map.mode[MODE_NORMAL] = {
	enter: function() {
		$($map.selector + ' li')
			.trigger('mouseleave')
			.unbind('hover');
	},
	exit: $.noop
};
/*
$map.mode[MODE_MOVE] = {
	enter: $.noop,
	exit: $.noop
};
$map.mode[MODE_CLONE] = {
	enter: $.noop,
	exit: $.noop
};
$map.mode[MODE_LINK] = {
	enter: $.noop,
	exit: $.noop
};
*/
$map.mode[MODE_SELECT] = {
	enter: function() {
		// when hovering
		$($map.selector + ' li').hover(
			$matrix.util.mode5hover,
			$matrix.util.mode5unhover
		);//end hover

		// TODO need to record what was selected
		var item = $(this).closest('li');
		$map.selected = [item];
		$map.select.call(item.find('a.asset_name'));

		// and we're already hovering over ourselves
		item.trigger('mouseenter');

console.log('context menu enabled');
		// enable the context menu for targets
		$('.asset_hold').contextMenu(true);
	},
	exit: function() {
		$('.asset_hold').contextMenu(false);
	}
}
$map.mode[MODE_USEME] = {
	enter: function() {
		$($map.selector).css('background-color', 'E9D4F4');
		$($map.selector + ' a.asset_name').contextMenu(true);
		$($map.selector + ' li').contextMenu(true);
	},
	exit: function() {
		$($map.selector).css('background-color', 'inherit');
		// disable the context menus
		$($map.selector + ' a.asset_name').contextMenu(false);
		$($map.selector + ' li').contextMenu(false);
	}
};


// utils
$matrix.util = {
	mode5hover: function () {
		$(this).children('a').wrapAll($('<span class="asset_hold"></span>'));
	},
	mode5unhover: function () {
		var cnt = $('span.asset_hold', $(this)).contents();
		$('span.asset_hold', $(this)).replaceWith(cnt);
	},
	// first argument is action, second is object containing command attributes
	// third is an array of children
	getCommand: function getCommand(action, params, children) {
		var ret = $('<command action="' + action + '"/>');
		if (params) {
			for (var param in params) {
				if (!params.hasOwnProperty(param)) continue;
				ret.attr(param, params[param]);
			}
		}
		switch (action) {
			case 'get assets':
			case 'move asset':
				children = children || [];
				for (var i = 0; i < children.length; i++) {
					var asset = $('<asset/>').appendTo(ret);
					for (var param in children[i]) {
						if (!children[i].hasOwnProperty(param)) continue;
						asset.attr(param, children[i][param]);
					}
				}
			break;

			default:
			break;
		}
		return ret;
	},
	// first argument is action, second is object containing command attributes
	// third is an array of children
	getCommandXML: function getCommandXML(action, params, children) {
		return $matrix.util.getCommand(action, params, children)
			.wrap('<p/>').parent().html();
	}
};

var initialise = function(callback) {
	$.ajax({
		url: $matrix.backend.getUrl('/_admin/'),
		type: 'POST',
		processData: false,
		data: $matrix.util.getCommandXML('initialise'),
		contentType: "text/xml",
		dataType: 'xml',
		error: function (XMLHttpRequest, textStatus, errorThrown) {
			console.log(XMLHttpRequest + textStatus + errorThrown);
		},
/*
		beforeSend: function () {
			if (!parent) {
				current_asset.parent().after('<ul class="loading"><li>Loading...</li></ul>');
			}
		},
*/
		success: function(xml) {

			var items = {};

			// Check each type that we find
			$(xml).find('type').each(function() {
				// Only include those with a flash_menu_path
				var path = $(this).attr('flash_menu_path');
				if (path) {
					// Set some of our vars that will populate our asset map
					var type_code = $(this).attr('type_code');
					var version = $(this).attr('version');
					var name = unescape($(this).attr('name'));
					var access = $(this).attr('allowed_access');
					var parent_type = parseInt($(this).attr('parent_type'));
					var instantiable = $(this).attr('instantiable');

					var screens = {};
					$(this).find('screen').each(function() {
						screens[$(this).attr('code_name')] = $(this).text();
					});

					if (!items[path]) {
						items[path] = {
							name: path,
							items: {}
						}
					}

					items[path]['items'][type_code] = {
						name: name
					};

				}// End if

			});// End each

			// TODO this is covered by the disabled context menu on a.asset_name
			$.contextMenu({
				selector: $map.selector,
//				autoHide: true,
				trigger: 'right',
				callback: function(key, options) {
					var m = "clicked: " + key;
window.console ? console.log(m) : alert(m);
console.log('callback.this', this);
console.log('callback.target', options.target);
				},
				items: items
			});

/*
			$('#map_root').on('click', function(e){
				console.log('clicked', this);
			});
*/

			callback && callback();
		}// End success

	});// End ajax
}

/**
* Plugin that allows you to browse the MySource Matrix asset tree structure.
* This is beneficial sometimes as you can bypass the java asset map.
* It sends XML to Matrix, then receives an XML response.
* Demo: http://www.puc.edu/dev/jquery-matrix-test-suite/matrix-map
*
* @version $Revision: 0.1
*/
var load_root = function load_root(assetid) {
	var obj = $(this), current_asset, parent = true, sub_root, attr_stat;

	// Find out what site we are at
	var proto = location.protocol;
	var site = location.host;
	var host_url = proto + '//' + site + '?SQ_ACTION=asset_map_request';

	// Construct our XML to send
	var xml_get = $matrix.util.getCommandXML('get assets', {}, [{
		assetid: assetid,
		start: 0,
		limit: 150,
		linkid: 10
	}]);

	// Get our children
	get_children(host_url, xml_get, parent, current_asset);

}

var get_children = function get_children(host_url, xml_get, parent, current_asset, sub_root) {
	// What do we add it to?
	var target = $map.selector;

	if (!parent) {
		// If we have already expanded the children we don't want to load the tree again
		if (current_asset.parent().hasClass('cache')) {
			if (current_asset.parent().hasClass('closed')) {
				current_asset.parent().next('ul').show();
				current_asset.parent().removeClass('closed');
				return;
			}
			// Hide our tree
			current_asset.parent().next('ul').hide();
			current_asset.parent().addClass('closed');
			return;
		}

		// Don't expand if we have no kids
		if (!current_asset.parent().hasClass('kids_closed')) return;

		// Create a new list
		current_asset.parent().after('<ul></ul>');

		// What do we add it to?
		target = current_asset.parent().next();

		// Construct our XML to send
		xml_get = $matrix.util.getCommandXML('get assets', {}, [{
			assetid: sub_root,
			start: 0,
			limit: 150,
			linkid: 10
		}]);

		// Check if we need to even get kids
		expand(current_asset, sub_root);

	}

	// Set somes image vars
	var type_2_path = '/__lib/web/images/icons/asset_map/not_visible.png';
	var type_2_image = '<img class="type_2" src="' + type_2_path + '" />';

	// Create our ajax to send the XML
	$.ajax({
		url: host_url,
		type: 'POST',
		processData: false,
		data: xml_get,
		contentType: "text/xml",
		dataType: 'xml',
		error: function (XMLHttpRequest, textStatus, errorThrown) {
			console.log(XMLHttpRequest + textStatus + errorThrown);
		},
		beforeSend: function () {
			if (!parent) {
				current_asset.parent().after('<ul class="loading"><li>Loading...</li></ul>');
			}
		},
		success: function(xml) {
			// Remove loading
			$('.loading').remove();
			// Check each asset that we find
			$(xml).find('asset').each(function() {
//console.log('asset', this);
				// Only include asset tags with attributes
				if ($(this).attr('assetid') > 0) {
					// if we know our parent, let's record that
					$(this).attr('parentid', current_asset ? current_asset.attr('assetid') : '1');
					// Set some of our vars that will populate our asset map
					var asset_id = unescape($(this).attr('assetid'));
					var asset_link_type = parseInt($(this).attr('link_type'));
					var asset_type_code = $(this).attr('type_code');
					var asset_num_kids = parseInt($(this).attr('num_kids'));
					var asset_name = unescape($(this).attr('name')).replace(/\+/g, ' ');

					var asset_image = '<img class="asset_image" src="/__data/asset_types/' + asset_type_code + '/icon.png" />';

					// is this a hidden asset?
					if (asset_link_type === 2) {
						// Type 2 link
						asset_image = type_2_image + asset_image;
					}

					var info = $('<li></li>').html('<a href="#" class="icon_hold">' + asset_image + '</a><a id="a' + asset_id + '" href="#" class="asset_name">' + asset_name + '</a>')
						.appendTo(target)
						// See if we have kids
						.addClass(asset_num_kids > 0 ? 'kids_closed' : '')
						.children('a:last');

					// add our info
					$.each(this.attributes, function(i, attr) {
						info.attr(attr.name, attr.value.replace(/^asset_/, ''));
					});
				}// End if

			});// End each

			// Set our first/last class
			$('ul li:first-child').addClass('first');
			$('ul li:last-child').addClass('last');

			// disable this context menu
			$($map.selector + ' li').contextMenu(false);
		}// End success

	});// End ajax

}

var expand = function expand(current_asset, sub_root) {

	// Check to see if we already have a class
	if (current_asset.hasClass('children')) {
		current_asset.removeClass('children');
	}
	else {
		// This must meen that we can expand, so add a class
		current_asset.addClass('children');
		// Let it know that we have expanded so we don't have to load again
		current_asset.parent('li').addClass('cache');
	}// End else

}// End expand

$.fn.assetMapHandler = function() {
	return {
		target: $.fn.matrixMaps[0],
		jsToJavaCall: function jsToJavaCall(type, command, params_str) {
console.log('handling', arguments);
console.log('with', this.target);
			switch (type) {
				case 'asset_locator':
					var bits = params_str.split("~");
					var types = bits[0].split('|');
					var positions = bits[1].split('|');

					$map.mode.change(MODE_USEME);
//					console.log('target', $(this.target));
//					$(this.target).find($map.selector).css('background-color', 'E9D4F4');
//					console.log($(this.target).css('background-color'));
					break;
				case 'asset_finder':
					switch (command) {
						case 'assetFinderStarted':
							var types = params_str.split('~');
							break;
						case 'assetFinderStopped':
							break;
					}

					break;
			}
		}
	};
}

// the main entry point
$.fn.matrixMap = function (options) {
	var defaults = {
		root: 1,
		showChildren: false,
		debug: true
	};

	options = $.extend(defaults, options);
	var obj = $(this), current_asset, parent = true, sub_root, attr_stat, selected;

	// TODO keep a reference to all maps
	$.fn.matrixMaps = [obj];

	// Find out what site we are at
/*
	var proto = location.protocol;
	var site = location.host;
	var host_url = proto + '//' + site + '?SQ_ACTION=asset_map_request';
*/

	// Create our element
	obj.append('<ul id="map_root"></ul>');

	initialise(function() { load_root(defaults.root); });

	// Lets double click our parents to show their children
	$(document).on('dblclick', $map.selector + ' li a', function() {
		// Get our current asset
		current_asset = $(this);
		sub_root = $(this).attr('id').replace('a', '');

		// Build our tree
		parent = false;
		get_children($matrix.backend.getUrl(), null, parent, current_asset, sub_root);
//		get_children(host_url, xml_get, parent, current_asset, sub_root);

		return false;

	});// End live dblclick

	// this is to handle a selection target (move/link/clone etc)
	$(document).on('click', $map.selector + ' li', function() {
console.log($map.selector + ' li', $map.mode.current);

		switch ($map.mode.current) {
			case MODE_USEME:

				break;
			case MODE_SELECT:
				// This is where we workaround the shortcomings of the context
				// menu we've chosen - it only allows one trigger
				// TODO handle left click here to show dialog
				// we must have something selected here or we're boned!
				if (!$map.selected.length) {
					alert('Expected something from the map to be selected!');
					return;
				}

				// store the original selection
				$map.previousSelected = $map.selected;

				// highlight the new selection
				$map.select.call($(this).find('a.asset_name'));

				// the dialog is enabled via the change to select mode
				break;
			default:
				break;
		}
	});

	// Bind when user clicks on asset text
	$(document).on('click', $map.selector + ' li a.asset_name', function() {
		// this fires before the context menu handler
console.log($map.selector + ' li a.asset_name', $map.mode.current);

		// TODO decide to show the menu or not
		switch ($map.mode.current) {
			// in this case we're behaving the same as the text, so we present
			// the wee menu with move/clone etc
			case MODE_SELECT:
console.log('clicked name while in select mode');
			break;
			default:
				$map.select.call(this);
			break;
		}
	});

	// Bind when user clicks icon to invoke a map mode
	$(document).on('click', $map.selector + ' a.icon_hold', function() {
console.log('clicked name while in mode ' + $map.mode.current);
		if ($map.mode.current !== MODE_SELECT) {
			$map.mode.change.call(this, MODE_SELECT);
		}
		else if ($map.selected.length) {
console.log('selected', $map.selected);
console.log('target', this);
		}

		return false;
	});//end click

	// Remove selector if clicking escape
	$(document).keyup(function(event){
		if (event.keyCode == 27 && $map.mode.current === 5) {
			$map.mode.change.call(this, 1);
			$map.selected = $map.previousSelected;
			$.each($map.selected, function() {
				$map.select.call(this);
			});
		}
	});//end keyup


	// ### Custom Functions ###

	function debug(msg) {
		if (defaults.debug) {
			console.log(msg);
		}
	}//end debug

};// End matrixMap

})(jQuery);
