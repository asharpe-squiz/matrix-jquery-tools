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



// TODO figure out where not_accessible.png is used
// see asset_map.inc:470
									'parameter.url.notaccessibleicon'	=> 'asset_map/not_accessible.png',
									'parameter.url.type2icon'			=> 'asset_map/not_visible.png',


*/

var init;

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
	// In all context menus on the tree we're going to try to target the
	// LI element for the tree node as it contains all relevant information
	// for that asset (and tree behaviour)
	$.extend($.contextMenu.defaults, {
		events: {
			show: function(options) {
console.log('show.this', this);
console.log('show.args', arguments);
				// store the node that was clicked
				options.$target = this.closest('li');
			},
			hide: function(options) {
				// this is called in addition to the command callback
				// so in the command callback we unset the target to
				// indicate our work is done, otherwise we want to keep the
				// mode the same
				if (!options.$target) {
console.log('context menu hide changing map mode from', $map.mode.current);
					$map.mode.change(1);
				}
			}
		}
	});

	// context menu for move/link/clone
	$map.menus['select'] = $map.selector + ' .asset_hold';
	$.contextMenu({
		selector: $map.menus['select'],
		trigger: 'left',
		disabled: true,
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

					$matrix.backend.moveAssets($map.selected, options.$target);
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


	// common function for useme result
	var usemeCallback = function usemeCallback(key, options) {
		if (!options.$target) {
			alert('Bad state - no target!');
		}

console.log('selector', options.selector);
console.log('target', options.$target);

		var attrs = options.$target.find('a.asset_name').get(0).attributes;

		// using setTimeout to uncouple things
		// may not be necessary
		setTimeout(function() {
			// see MatrixMenus.java:205
			asset_finder_done(
				attrs.getNamedItem('assetid'),
				attrs.getNamedItem('name'),
				attrs.getNamedItem('url'),
				attrs.getNamedItem('linkid')
			);
		}, 100);

		// this indicates to the context menus hide method that
		// we've achieved our goal
		delete(options.$target);
	};


	// context menu for useme via left click
	$map.menus['useme-li'] = $map.selector + ' li';
	$.contextMenu({
		// TODO need to allow expansion when this is active
		selector: $map.menus['useme-li'],
		trigger: 'left',
		disabled: true,
		events: {
			show: function(options) { // override the default above
				// store the node that was clicked
// TODO keep this consisten - make target a reference to jquery
				options.$target = this;
			}
		},
		items: {
			useme: {
				name: 'Use me',
				callback: usemeCallback
			}
		}
	});

	// context menu for useme via left click
	$map.menus['useme-name'] = $map.selector + ' a.asset_name';
	$.contextMenu({
		// TODO need to allow expansion when this is active
		selector: $map.menus['useme-name'],
		trigger: 'left',
		disabled: true,
		items: {
			useme: {
				name: 'Use me',
				callback: usemeCallback
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
		},
		// this stores the context menu items for asset typs
		// we're storing the menu details here because they'll be built dynamically
		// and this gives us the flexibility to add/remove types etc without reload
		menuItems: {},
		// store the selectors for the different menus to accurately enable/disable
		menus: {}
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
//		$($map.selector + ' .asset_hold').contextMenu(true);
		$($map.menus['select']).contextMenu(true);
	},
	exit: function() {
		$($map.menus['select']).contextMenu(true);
//		$('.asset_hold').contextMenu(false);
	}
}
$map.mode[MODE_USEME] = {
	enter: function() {
		$($map.selector).css('background-color', 'E9D4F4');
		$($map.menus['useme-name']).contextMenu(true);
		$($map.menus['useme-li']).contextMenu(true);
//		$($map.selector + ' a.asset_name').contextMenu(true);
//		$($map.selector + ' li').contextMenu(true);
	},
	exit: function() {
		$($map.selector).css('background-color', 'inherit');
		// disable the context menus
		$($map.menus['useme-name']).contextMenu(false);
		$($map.menus['useme-li']).contextMenu(false);
//		$($map.selector + ' a.asset_name').contextMenu(false);
//		$($map.selector + ' li').contextMenu(false);
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
	},
	getIconUrl: function getIconUrl(assetType) {
		return $matrix.backend.getUrl('/__data/asset_types/' + assetType + '/icon.png');
	},
	createCSSRule: function createCSSRule(assetType) {
		_createCSSRule('.context-menu-item.icon-' + assetType, 'background-image: url(' + $matrix.util.getIconUrl(assetType) + ');');
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
init = $(xml);
//console.log(init);
			var items = {};

			// an array of type names for sorting
			var types = [];
			// a map of arrays of type names for sorting
			var subTypes = {};

			// We need to order the types by their type_codes
			// see MatrixMenus.java:369

			// Check each type that we find
			$(xml).find('type').each(function() {
				var $this = $(this);

				var path = $this.attr('flash_menu_path');
				var type = $this.attr('type_code');

				// get screens (context menu items)
				// TODO order these
				var m = $map.menuItems[$this.attr('type_code')] = {};
				var mIndex = 0;
				$this.find('screen').each(function() {
					m[$(this).attr('code_name')] = {
						name: $(this).text(),
						index: mIndex++
					}
				});

				// we skip if there's no path or it's not instantiable
				// see AssetType.java:75
				var instantiable = $this.attr('instantiable') === '1' || $this.attr('allowed_access') === 'system';

				if (path && instantiable) {
					if (!items[path]) {
						items[path] = {
							name: path,
							icon: type, // takes the icon of the first type in this group
							items: {}
						};

						// info for sorting
						types.push(path);
						subTypes[path] = [];
					}

					items[path]['items'][type] = {
						name: unescape($this.attr('name')),
						// TODO need to use the generic icon when this fails
						icon: type,
						info: $this
					};
					// info for sorting
					subTypes[path].push(unescape($this.attr('name')));

					// construct an icon style
					$matrix.util.createCSSRule(type);
				}

			});// End each

			// see http://stackoverflow.com/questions/8996963/how-to-perform-case-insensitive-sorting-in-javascript
			var caseInsensitiveSort = function caseInsensitiveSort(a, b) {
				if (a.toLowerCase() < b.toLowerCase()) return -1;
				if (a.toLowerCase() > b.toLowerCase()) return 1;
				return 0;
			};

			types.sort(caseInsensitiveSort);
			items['order'] = types;

			// ordering sucks!
			// we need to order the submenus by name, however the menus
			// are built using their keys to index them :-/

			// find a menu key given the menu and an items name
			var findKey = function findKey(menu, itemName) {
				for (var k in menu) {
					if (!menu.hasOwnProperty(k)) continue;

					if (menu[k]['name'] === itemName) return k;
				}

//console.log('menu', menu);
//console.log('itemName', itemName);
				throw new Error('Cannot find menu item named "' + itemName + '"');
			};

			// sort the submenus
			for (type in subTypes) {
				if (!subTypes.hasOwnProperty(type)) continue;

				// order by name
				subTypes[type].sort(caseInsensitiveSort);

				// now replace with the type_code
				for (var i = 0, last = subTypes[type].length; i < last; i++) {
					subTypes[type][i] = findKey(items[type]['items'], subTypes[type][i]);
				}

				items[type]['items']['order'] = subTypes[type];

				// see jquery.contextMenu.js:1130
				// lame attempt at setting the width of the submenu
/*
				var longest = 0;
				$(subTypes[type]).each(function(i, subType) {
					if (items[type]['items'][String(subType)]['name'].length > longest) {
						longest = items[type]['items'][String(subType)]['name'].length;
					}
				});
				switch (true) {
					case longest > 25: items[type]['className'] = 'wide'; break;
					case longest > 15: items[type]['className'] = 'medium'; break;
				}
console.log(type, longest);
*/
			}

			// whack a separator and folder on the end
			items['sep'] = '-';
			items['folder'] = {
				name: 'Folder',
				icon: 'folder'
			};
			items['order'].push('sep');
			items['order'].push('folder');

			// preferring to do the folder CSS here because the base URL can change
			$matrix.util.createCSSRule('folder');

//console.log('items', items);


			// common bits on each types context menu
			var typeCommon = {
				sep: '-',
				teleport: {
					name: 'Teleport',
					disabled: true
				},
				refresh: {
					name: 'Refresh',
					callback: function(key, options) {
console.log('TODO refreshing something')
					},
					disabled: true
				},
				prev: {
					name: 'No Previous Child',
					disabled: true,
					callback: function(key, options) {
console.log('TODO figure out what previous child option does');
					}
				},
				'new': {
					name: 'New Child',
					items: items
				}
			};

			// create context menus for each asset type
			$.each($map.menuItems, function(k, v) {
				$.extend(v, typeCommon);
			});


			$map.menus['asset'] = $map.selector + ' li.asset';
			$.contextMenu({
				selector: $map.menus['asset'],
				trigger: 'right',
				build: function($trigger, e) {
console.log('building menu', arguments);
					return {
						callback: $.noop,
						items: {}
					}
				}
			});


console.log('$map.menus', $map.menus);

			$map.menus['main'] = $map.selector;
			$.contextMenu({
				selector: $map.menus['main'],
//				autoHide: true,
				trigger: 'right',
				callback: function(key, options) {
					var m = "clicked: " + key;
window.console ? console.log(m) : alert(m);
console.log('callback.this', this);
console.log('callback.target', options.target);
				},
				items: items
//				items: $map.menus['page_standard']
			});

			// play on ;)
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

					var info = $('<li></li>')
						.html('<a href="#" class="icon_hold">' + asset_image + '</a><a id="a' + asset_id + '" href="#" class="asset_name">' + asset_name + '</a>')
						.appendTo(target)
						// See if we have kids
						.addClass(asset_num_kids > 0 ? 'kids_closed' : '')
						.addClass('asset') // the following classes are used for menu control (menus are based on selectors)
						.addClass('asset-type-' + asset_type_code)
						.children('a:last');

					// add our info
					// TODO this is bad, should consider using prop or data instead
					// see http://api.jquery.com/prop/
					$.each(this.attributes, function(i, attr) {
						info.attr(attr.name, attr.value.replace(/^asset_/, ''));
					});
				}// End if

			});// End each

			// Set our first/last class
			$('ul li:first-child').addClass('first');
			$('ul li:last-child').addClass('last');

			// disable this context menu
//			$($map.selector + ' li').contextMenu(false);
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

//					console.log('target', $(this.target));
//					$(this.target).find($map.selector).css('background-color', 'E9D4F4');
//					console.log($(this.target).css('background-color'));
					break;
				case 'asset_finder':
					switch (command) {
						case 'assetFinderStarted':
							var types = params_str.split('~');
							$map.mode.change(MODE_USEME);
							break;
						case 'assetFinderStopped':
							break;
					}

					break;
			}
		},
		getMap: function() { return $map; }
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

	initialise(function() {load_root(defaults.root);});

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

// see http://stackoverflow.com/questions/1720320/how-to-dynamically-create-css-class-in-javascript-and-apply
function _createCSSRule(selector, style) {
    if (!document.styleSheets) {
        return;
    }

    if (document.getElementsByTagName("head").length == 0) {
        return;
    }

    var stylesheet;
    var mediaType;
    if (document.styleSheets.length > 0) {
        for (i = 0; i < document.styleSheets.length; i++) {
            if (document.styleSheets[i].disabled) {
                continue;
            }
            var media = document.styleSheets[i].media;
            mediaType = typeof media;

            if (mediaType == "string") {
                if (media == "" || (media.indexOf("screen") != -1)) {
                    styleSheet = document.styleSheets[i];
                }
            } else if (mediaType == "object") {
                if (media.mediaText == "" || (media.mediaText.indexOf("screen") != -1)) {
                    styleSheet = document.styleSheets[i];
                }
            }

            if (typeof styleSheet != "undefined") {
                break;
            }
        }
    }

    if (typeof styleSheet == "undefined") {
        var styleSheetElement = document.createElement("style");
        styleSheetElement.type = "text/css";

        document.getElementsByTagName("head")[0].appendChild(styleSheetElement);

        for (i = 0; i < document.styleSheets.length; i++) {
            if (document.styleSheets[i].disabled) {
                continue;
            }
            styleSheet = document.styleSheets[i];
        }

        var media = styleSheet.media;
        mediaType = typeof media;
    }

    if (mediaType == "string") {
        for (i = 0; i < styleSheet.rules.length; i++) {
            if (styleSheet.rules[i].selectorText.toLowerCase() == selector.toLowerCase()) {
                styleSheet.rules[i].style.cssText = style;
                return;
            }
        }

        styleSheet.addRule(selector, style);
    } else if (mediaType == "object") {
        for (i = 0; i < styleSheet.cssRules.length; i++) {
            if (styleSheet.cssRules[i].selectorText.toLowerCase() == selector.toLowerCase()) {
                styleSheet.cssRules[i].style.cssText = style;
                return;
            }
        }

        styleSheet.insertRule(selector + "{" + style + "}", 0);
    }
}


})(jQuery);
