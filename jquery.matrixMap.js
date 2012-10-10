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


TODO
	polling for refresh - see AssetMap.java:246

	click the plus to expand/contract the tree

	fire some events so we can start things sanely, like the polling

	figure out where not_accessible.png is used asset_map.inc:470
		'parameter.url.notaccessibleicon'	=> 'asset_map/not_accessible.png',
		'parameter.url.type2icon'			=> 'asset_map/not_visible.png',

	consistency
		sometimes we're passing around raw DOM, other times jQuery object
		sometimes we're passing around a.asset_name other times an li

	icon for expansion of bottom tree node (or replace the tree)

*/

var init;

// allow the asset finder to work
//var SQ_DOCUMENT_LOADED = false;


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
	// allow the asset finder to work
	SQ_DOCUMENT_LOADED = true;
});

var buildContextMenus = function buildContextMenus() {

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
		},
		// bumping this up to cover the "hidden" (type_2 link) asset icon
		zIndex: 2
	});

	// context menu for move/link/clone
	$map.menus['select'] = $map.selector + ' .asset_name.selectable';
	$.contextMenu({
		selector: $map.menus['select'],
		trigger: 'left',
		disabled: true,
		events: {
			hide: $.noop // override the default above
		},
		items: {
			move: {
				name: $matrix.util.translate('asset_map_menu_move_here'),
				callback: function(key, options) {
					if (!(options.$target && $map.selected.length)) {
						alert($matrix.util.translate('asset_map_error_invalid_node'));
						return;
					}

					$matrix.backend.moveAssets($map.selected, options.$target);
				}
			},
			newlink: {
				name: $matrix.util.translate('asset_map_menu_link_here'),
				callback: function(key, options) {
					if (!(options.$target && $map.selected.length)) {
						alert($matrix.util.translate('asset_map_error_invalid_node'));
						return;
					}

					$matrix.backend.linkAssets($map.selected, options.$target);
				}
			},
			clone: {
				name: $matrix.util.translate('asset_map_menu_clone_here'),
				disabled: true,
				callback: function(key, options) {
					if (!(options.$target && $map.selected.length)) {
						alert($matrix.util.translate('asset_map_error_invalid_node'));
						return;
					}

					$matrix.backend.cloneAssets($map.selected, options.$target);
				}
			},
			sep: '-',
			cancel: {
				name: $matrix.util.translate('asset_map_menu_cancel'),
				callback: function(key, options) {
					$map.mode.change(1);
				}
			}
		}
	});


	// common function for useme result
	var usemeItems = {
		useme: {
			name: $matrix.util.translate('asset_map_menu_useme'),
			callback: function usemeCallback(key, options) {
				if (!options.$target) {
					alert('Bad state - no target!');
				}

console.log('selector', options.selector);
console.log('target', options.$target);

				var attrs = options.$target.find('a.asset_name').get(0).attributes;
				// see MatrixTreeNode.java:141
				var getUrl = function(url, webPath) {
					if (url == null) {
						return "";
					} else if (webPath == null) {
						return url;
					}
					return url + "/" + webPath;
				}

				// using setTimeout to uncouple things - may not be necessary
				setTimeout(function() {
					// see MatrixMenus.java:205
					asset_finder_done(
						attrs.getNamedItem('assetid').value,
						attrs.getNamedItem('name').value,
						// TODO this is still wrong
						// I have no idea how this is working
						// the java version responds with a path of "/" for asset that had no previous URL
//						getUrl(attrs.getNamedItem('url').value, attrs.getNamedItem('web_path').value),
						attrs.getNamedItem('url').value,
						attrs.getNamedItem('linkid').value
					);
				}, 100);

				// this indicates to the context menus hide method that
				// we've achieved our goal
				delete(options.$target);
			}
		}
	};


	// context menu for useme via left click
	$map.menus['useme-li'] = $map.selector + ' li';
	$.contextMenu({
		// TODO need to allow expansion when this is active
		selector: $map.menus['useme-li'],
		trigger: 'right',
		disabled: true,
		events: {
			show: function(options) { // override the default above
				// store the node that was clicked (jQuery)
				options.$target = this;
			}
		},
		items: usemeItems
	});

	// context menu for useme via left click
	$map.menus['useme-name'] = $map.selector + ' a.asset_name';
	$.contextMenu({
		// TODO need to allow expansion when this is active
		selector: $map.menus['useme-name'],
		trigger: 'right',
		disabled: true,
		items: usemeItems
	});
};



$.fn.matrix = {
	map: {
		// TODO supply these from PHP
		params: {
			refreshInterval: 2000, // milliseconds
			adminSuffix: '_admin/', // don't fuck this up, xhr doesn't follow redirects
			fetchLimit: 150
		},
		// TODO get this from elsewhere
		locale: 'en_AU',
		selector: '#map_root',
		mode: {
			current: MODE_NORMAL,
			// TODO we're passing the scope on here, so we'd better some up with
			// some rules about how to use it :-/
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
		// TODO this can be much more efficient
		select: function() {
			if (this in $map.selected) {
console.log('already selected', this);
				return;
			}
console.log('selecting', this);

			// add this item
			$map.selected.push(this);

			$map._redrawSelected();
		},
		// refresh the selected nodes
		_redrawSelected: function() {
			// Remove all colors first
			$($map.selector + ' li a').removeClass('live construction');

			// reset the colors
			$.each($map.selected, function() {
				switch ($(this).attr('status')) {
					case STATUS_LIVE:
						$(this).addClass('live');
					break;
					case STATUS_CONSTRUCTION:
						$(this).addClass('construction');
					break;
					default:
					break;
				}
			})
		},
		// this stores the context menu items for asset typs
		// we're storing the menu details here because they'll be built dynamically
		// and this gives us the flexibility to add/remove types etc without reload
		menuItems: {},
		// store the selectors for the different menus to accurately enable/disable
		menus: {},
		checkRefresh: function checkRefresh() {
			// TODO we could be anal and check for a string.. meh
			if (SQ_REFRESH_ASSETIDS) {
				refreshAssets(SQ_REFRESH_ASSETIDS.split('|'));
				SQ_REFRESH_ASSETIDS = '';
			}

			// check again
			setTimeout($map.checkRefresh, $map.params.refreshInterval);
		}
	},
	backend: {
		// TODO work out our path better
		url: location.protocol + '//' + location.host + '/',
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
		// TODO make asset an object
		getScreenUrl: function getScreenUrl(screen, asset) {
			// see MatrixMenus.java:147
//				Matrix.getProperty("parameter.url.baseurl") +
//				Matrix.getProperty("parameter.backendsuffix") +
//				"/?SQ_BACKEND_PAGE=main&backend_section=" +
//				"am&am_section=edit_asset&assetid=" + assetid +
//				"&sq_asset_path=" + assetPath + "&sq_link_path=" +
//				linkPath + "&asset_ei_screen=" + screenName;
console.log('asset', asset);

			// TODO get the link path which is a comma separated list of link
			// ids up to the root
			// TODO get the asset path which is a comma separated list of asset
			// ids up to the root

			// TODO get backendsuffix from somewhere
			return $matrix.backend.getUrl($map.params.adminSuffix, {
				SQ_BACKEND_PAGE: 'main',
				backend_secion: 'am',
				am_section: 'edit_asset',
				assetid: asset.attr('assetid'),
				sq_asset_path: asset.attr('path'),
				sq_link_path: asset.attr('linkid'),
				asset_ei_screen: screen,
				SQ_ACTION: null // overwrite this
			});
		},
		// common handler for move/clone/link
		_handleAssets: function _handleAssets(action, assets, $target) {
			var args = $.map(assets, function(asset) {
				var $asset = $(asset);
				return {
					assetid: $asset.attr('assetid'),
					linkid: $asset.attr('linkid'),
					parentid: $asset.attr('parentid')
				};
			});

			$map.mode.change(1);

			$.ajax({
				url: $matrix.backend.getUrl($map.params.adminSuffix),
				type: 'POST',
				processData: false,
				data: $matrix.util.getCommandXML(action, {
					to_parent_assetid: $target.find('a.asset_name').attr('assetid'),
					to_parent_pos: 0 // TODO positional selection
				}, args),
				contentType: "text/xml",
				dataType: 'xml',
				error: function (XMLHttpRequest, textStatus, errorThrown) {
					console.log(XMLHttpRequest, textStatus, errorThrown);
				},
				success: function(xml) {
					var url = $(xml).find('url[js_function=asset_map_popup]').text();
					url && open_hipo(url);
				}
			});
		},
		moveAssets: function(assets, $target) {
			$matrix.backend._handleAssets('move asset', assets, $target);
		},
		linkAssets: function(assets, $target) {
			$matrix.backend._handleAssets('new link', assets, $target);
		},
		cloneAssets: function(assets, $target) {
			$matrix.backend._handleAssets('clone', assets, $target);
		}
	}
};

$matrix = $.fn.matrix;
$map = $matrix.map;

// attach mode handlers here because JS doesn't evaluate the LHS of an object property
// TODO document the context these methods are triggered in
$map.mode[MODE_NORMAL] = {
	enter: function() {
		// enable the standard asset context menu
		$($map.menus['asset']).contextMenu(true);

		// this is in the case we press escape after entering another mode
		// reselect what might have been selected
		$map.selected = $map.previousSelected;
		$map.previousSelected = [];

		$map._redrawSelected();
	},
	exit: function() {
		// disable the standard asset context menu
		$($map.menus['asset']).contextMenu(false);
	}
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
		$($map.selector + ' li')
			.hover(
				$matrix.util.mode5hover,
				$matrix.util.mode5unhover
			)
			// TODO this could be setup at menu creation time and left alone
			// unnecessary to add/remove this class
			.find('.asset_name')
				.addClass('selectable');

		// enable link/copy/clone context menu
		$($map.menus['select']).contextMenu(true);
	},
	exit: function() {
		// disable link/copy/clone context menu
		$($map.menus['select']).contextMenu(false);

		// disable hover
		$($map.selector + ' li')
			.trigger('mouseleave')
			.unbind('hover')
			.find('.asset_name')
				.removeClass('selectable');
	}
}
$map.mode[MODE_USEME] = {
	color: null,
	enter: function() {
		// funky colour
		$map.mode[MODE_USEME].color = $($map.selector).css('background-color');
		$($map.selector).css('background-color', 'E9D4F4');

		// enable the "useme" context menus
		$($map.menus['useme-name']).contextMenu(true);
		$($map.menus['useme-li']).contextMenu(true);
	},
	exit: function() {
		// inherit whatever colour came before
		$($map.selector).css('background-color', $map.mode[MODE_USEME].color);

		// disable the "useme" context menus
		$($map.menus['useme-name']).contextMenu(false);
		$($map.menus['useme-li']).contextMenu(false);
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
	// see http://forum.jquery.com/topic/adding-xml-nodes-to-an-xmldocument-with-jquery-1-5
	getCommand: function getCommand(action, params, children) {
		var xml = $.parseXML('<command/>');
		var $xml = $(xml).find('command').attr('action', action);

		if (params) {
			for (var param in params) {
				if (!params.hasOwnProperty(param)) continue;
				$xml.attr(param, params[param]);
			}
		}
		switch (action) {
			case 'get assets':
			case 'move asset':
			case 'new link':
				children = children || [];
				for (var i = 0; i < children.length; i++) {
					var $asset = $(xml.createElement('asset')).appendTo($xml);

					for (var param in children[i]) {
						if (!children[i].hasOwnProperty(param)) continue;
						$asset.attr(param, children[i][param]);
					}
				}
			break;

			default:
				console.log('Doing nothing for command', arguments);
			break;
		}
		return $xml;
	},
	// first argument is action, second is object containing command attributes
	// third is an array of children
	getCommandXML: function getCommandXML(action, params, children) {
		var command = $matrix.util.getCommand(action, params, children).get(0);

		// see http://joncom.be/code/javascript-xml-conversion/
		return window.ActiveXObject ? command.xml : (new XMLSerializer()).serializeToString(command);
	},
	getIconUrl: function getIconUrl(assetType) {
		return $matrix.backend.getUrl('/__data/asset_types/' + assetType + '/icon.png');
	},
	createCSSRule: function createCSSRule(assetType) {
		_createCSSRule('.context-menu-item.icon-' + assetType, 'background-image: url(' + $matrix.util.getIconUrl(assetType) + ');');
	},
	translate: function translate() {
console.log('translating', arguments);
		// see Matrix.java:55
		var translation = $matrix.util.translationData[$map.locale][arguments[0]];

		if (!translation) return arguments[0];
		if (arguments.length > 1) {
			return $matrix.util.replaceParams(translation, [].splice.call(arguments, 1));
		}

		return translation;
	},
	// TODO this needs be initialised with at least $map.locale
	translationData: {},
	// see http://stackoverflow.com/questions/1353408/messageformat-in-javascript-parameters-in-localized-ui-strings
	replaceParams: function replaceParams(string, replacements) {
		return string.replace(/\{(\d+)\}/g, function() {
			return replacements[arguments[1]];
		});
	}
};


var initialise = function initialise(callback) {
	initialiseTranslations(function() {
		initialiseAssets(callback);
	});
};


var initialiseTranslations = function initialiseTranslations(callback) {
	$.ajax({
		url: $matrix.backend.getUrl($map.params.adminSuffix),
		type: 'POST',
		processData: false,
		data: $matrix.util.getCommandXML('get translations'),
		contentType: "text/xml",
		dataType: 'xml',
		error: function (XMLHttpRequest, textStatus, errorThrown) {
			console.log(XMLHttpRequest, textStatus, errorThrown);
		},
		success: function(xml) {
			var info = {};
			var $translations = $(xml).find('translations');

			$.each($translations.text().split("\n"), function(i, trans) {
				if (!trans) return;
				var bits = trans.match(/([^=]+[^ ]) *= *([^ ]*.*)/);
				if (bits && bits.length)
					info[bits[1]] = bits[2];
			});

			$matrix.util.translationData[$translations.attr('locale')] = info;

			callback && callback();
		}
	});
};


var initialiseAssets = function initialiseAssets(callback) {
	$.ajax({
		url: $matrix.backend.getUrl($map.params.adminSuffix),
		type: 'POST',
		processData: false,
		data: $matrix.util.getCommandXML('initialise'),
		contentType: "text/xml",
		dataType: 'xml',
		error: function (XMLHttpRequest, textStatus, errorThrown) {
			console.log(XMLHttpRequest, textStatus, errorThrown);
		},
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
					name: $matrix.util.translate('asset_map_menu_teleport'),
					disabled: true
				},
				refresh: {
					name: $matrix.util.translate('asset_map_menu_refresh'),
					callback: function(key, options) {
console.log('TODO refreshing something')
					},
					disabled: true
				},
				// TODO this item needs to be replaced after an asset has been
				// created
				prev: {
					name: $matrix.util.translate('asset_map_menu_no_previous_child'),
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
				events: {
					show: function(options) { // override the default
// TODO keep this consistent - make target a reference to jquery
						// store the node that was clicked
						options.$target = this;
					}
				},
				build: function($trigger, e) {
					var asset = $trigger.find('a.asset_name');
					var items = $map.menuItems[asset.attr('type_code')];
					return {
						callback: function(key, options) {
							var screenUrl = $matrix.backend.getScreenUrl(key, asset);
console.log('opening', screenUrl);
							// see AssetMap.java:74
							parent.frames['sq_main'].location = screenUrl;
						},
						items: items
					}
				}
			});


console.log('$map.menus', $map.menus);

			$map.menus['main'] = $map.selector;
			$.contextMenu({
				selector: $map.menus['main'],
				trigger: 'right',
				callback: function(key, options) {
					var m = "clicked: " + key;
window.console ? console.log(m) : alert(m);
console.log('callback.this', this);
console.log('callback.target', options.target);
				},
				items: items
			});

			// play on ;)
			callback && callback();
		}// End success

	});// End ajax
}

var refreshAssets = function refreshAssets(assetids) {
	// get the asset
	var $assets = $('[assetid=' + assetids.join('],[assetid=') + ']', $map.selector);
console.log('refreshing', $assets);

	// an array of asset objects
	var args = [];

	$assets.each(function(i, asset) {
		$.each(asset.getAttribute('linkid').split('|'), function(i, linkid) {
			args.push({
				assetid: asset.getAttribute('assetid'),
				start: 0,
				limit: $map.params.fetchLimit,
				linkid: linkid
			});
		});
	});

console.log('args', args);
}

var load_root = function load_root(assetid) {
	var current_asset, parent = true;

	// Find out what site we are at
	var proto = location.protocol;
	var site = location.host;
	var host_url = proto + '//' + site + '?SQ_ACTION=asset_map_request';

	// Construct our XML to send
	var xml_get = $matrix.util.getCommandXML('get assets', {}, [{
		assetid: assetid,
		start: 0,
		limit: $map.params.fetchLimit,
		linkid: 10
	}]);

	// Get our children
	get_children(xml_get, parent, current_asset);

}

var get_children = function get_children(xml_get, parent, current_asset, sub_root) {
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
			limit: $map.params.fetchLimit,
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
		url: $matrix.backend.getUrl(),
		type: 'POST',
		processData: false,
		data: xml_get,
		contentType: "text/xml",
		dataType: 'xml',
		error: function (XMLHttpRequest, textStatus, errorThrown) {
			console.log(XMLHttpRequest, textStatus, errorThrown);
		},
		beforeSend: function () {
			if (!parent) {
				current_asset.parent().after('<ul class="loading"><li>Loading...</li></ul>');
			}
		},
		success: function(xml) {
			// Remove loading
			$('.loading').remove();

			// this is to control how we deal with the different values when we attach them to the dom
			var handlers = {
				integer: function(input) {return parseInt(input, 10);},
				string: function(input) {return unescape(input.replace(/\+/g, ' '));},
				'default': function(input) {return input;}
			};
			var fields = {
				link_type: handlers.integer,
				num_kids: handlers.integer,
				sort_order: handlers.integer,
				assetid: handlers.string,
				type_code: handlers.string,
				name: handlers.string,
				url: handlers.string
			};

			var getField = function(asset, fieldName) {
				return fields[fieldName] ? fields[fieldName](asset.attr(fieldName)) : asset.attr(fieldName);
			}

			// Check each asset that we find
			$(xml).find('asset').each(function() {
				var $asset = $(this);

				if ($asset.get(0).attributes.length) {
					// if we know our parent, let's record that
					$asset.attr('parentid', current_asset ? current_asset.attr('assetid') : '1');

					var asset_image = '<img class="asset_image" src="/__data/asset_types/' + getField($asset, 'type_code') + '/icon.png" />';

					// is this a hidden asset?
					if (getField($asset, 'link_type') === 2) {
						// Type 2 link
						asset_image = type_2_image + asset_image;
					}

					var info = $('<li></li>')
						.html('<a href="#" class="icon_hold">' + asset_image + '</a><a id="a' + getField($asset, 'assetid') + '" href="#" class="asset_name">' + getField($asset, 'name') + '</a>')
						.appendTo(target)
						// See if we have kids
						.addClass(getField($asset, 'num_kids') > 0 ? 'kids_closed' : '')
						.addClass('asset') // used for menu control (menus are based on selectors)
						.children('a:last');

					// add our info
					// TODO this is bad, should consider using prop or data instead to store the values
					// see http://api.jquery.com/prop/
					$.each(this.attributes, function(i, attr) {
						info.attr(attr.name, getField($asset, attr.name));
					});
				}// End if

			});// End each

			// Set our first/last class
			$('ul li:first-child').addClass('first');
			$('ul li:last-child').addClass('last');
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

/**
* Plugin that allows you to browse the MySource Matrix asset tree structure.
* This is beneficial sometimes as you can bypass the java asset map.
* It sends XML to Matrix, then receives an XML response.
*
* @version $Revision: 0.1
*/
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

	// Create our element
	obj.append('<ul id="map_root"></ul>');

	initialise(function() {
		buildContextMenus();
		load_root(defaults.root);

		// TODO this needs to be triggered on an event when the asset map is ready
		setTimeout($map.checkRefresh, 10000);
	});

	// Lets double click our parents to show their children
	$(document).on('dblclick', $map.selector + ' li a', function() {
		// Get our current asset
		current_asset = $(this);
		sub_root = $(this).attr('id').replace('a', '');

		// Build our tree
		get_children(null, false, current_asset, sub_root);

		// stop the event
		return false;
	});


	// this is to handle a selection target (move/link/clone etc)
	$(document).on('click', $map.selector + ' li', function() {
console.log($map.selector + ' li', $map.mode.current);

		switch ($map.mode.current) {
			case MODE_USEME:
				// anything?
			break;
			case MODE_SELECT:
				// This is where we workaround the shortcomings of the context
				// menu we've chosen - it only allows one trigger
				// TODO handle left click here to show dialog
				// we must have something selected here or we're boned!
				if (!$map.selected.length) {
					alert($matrix.util.translate('asset_map_error_invalid_node'));
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
	// this fires before the context menu handler because we're stacked above
	// the menu trigger
	$(document).on('click', $map.selector + ' li a.asset_name', function(event) {
//console.log($map.selector + ' li a.asset_name', $map.mode.current);

		// TODO decide to show the menu or not
		switch ($map.mode.current) {
			// in this case we're behaving the same as the text, so we present
			// the wee menu with move/clone etc
			case MODE_SELECT:
console.log('clicked a.asset_name while in select mode');
			break;
			default:
				// it's the meta key on OSX (apple key)
				// if not pressed, then we have a single selection
				if (!event.metaKey)
					$map.selected = [];

				$map.select.call(this);
			break;
		}

		// we let the event continue to get to the context menu handler
	});


	// Bind when user clicks icon to invoke a map mode
	$(document).on('click', $map.selector + ' a.icon_hold', function(event) {
console.log('clicked name while in mode ' + $map.mode.current);

		switch ($map.mode.current) {
			case MODE_SELECT:
				// I don't believe we get here, the context menu handler
				// has already eaten the event, which is OK
console.log('clicked a.icon_hold while in select mode');
console.log('selected', $map.selected);
console.log('target', this);
			break;
			default:
				// changing into select mode
				// hmmm, we need some info about the event when doing this change

				// record what was selected
				var li = $(this).closest('li');
				var asset = li.find('a.asset_name');

				// select should always be called with the a.asset_name
				$map.select.call(asset.get(0));

				// and we're already hovering over ourselves
				li.trigger('mouseenter');

				$map.mode.change.call(this, MODE_SELECT);
			break;
		}

		// don't let the event continue
		return false;
	});


	// Remove selector if clicking escape
	$(document).keyup(function(event) {
		switch (event.keyCode) {
			case 27: // escape
				if ($map.mode.current !== 5) return;
				$map.mode.change.call(this, 1);
			break;
			case 46: // delete
				if ($map.mode.current !== 1) {
console.log('cannot delete from mode', $map.mode.current);
					return;
				}
				if (!$map.selected.length) {
console.log('nothing selected', $map.selected);
					return;
				}
				console.log('deleting', $map.selected);
			break;
		}
	});//end keyup



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

