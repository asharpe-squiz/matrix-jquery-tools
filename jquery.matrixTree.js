/*
Design

There will be a single $.squiz.matrix object in the namespace and it contains

	asset - information about assets, ie. status
	assetMap - the implementation of the assetMap (singleton)

One can create multiple visual representations of the assetMap via

	assetMap.createTree

which can be customised in the following ways

	TODO

Each instance of the tree is a jstree and operations on that tree will be
handled by the core assetMap and propagated to the other trees as necessary (eg.
expansion of the tree) via events

When the first tree is created, initialisation is begin and upon completion of
the initialisation the init.assetMap event is fired (and can be listened to on the
assetMap)

Events on JS objects are supported in jQuery
see http://forum.jquery.com/topic/triggering-custom-events-on-js-objects



Code structure (this file) - modelled on the jstree structure, something like

closure ($) {

	// - check for multiple inclusions
	// TODO discuss namespaces
	if($.squiz.matrix.assetMap) { return; }

	// - create namespaces

	// - utility functions

	// - variable to hold instances
	var instances = [];

	// - expose jquery method
	$.fn.matrixTree = function( method ) {
		...
	}

	// - singleton, exposed methods
	$.squiz.matrix.assetMap = {
		...
	}
	// - set the prototype for all instances
	$.squiz.matrix.assetMap._fn = $.squiz.matrix.assetMap._instance.prototype = {};

	// - load global bits when the document is ready
	$(function() {
		...
	}

	// - add core functionality (plugin)
	$.squiz.matrix.assetMap.plugin("core", {
		// required members
		__init : $.noop,
		__destroy : $.noop,
		_fn : {},
		defaults : false
	})

}(jQuery)


Other plugins can be added with separate files, and go something like

closure ($) {
	$.squiz.matrix.assetMap.plugin("ui", {
		...
	});
}

To find your way around this file you can use the comments above as search term


Limitations:
	use me - the context menu we've chosen only allows one trigger, so we've
		used two context maps to be triggered by different means


TODO

	upgrade jquery
		see http://jsfiddle.net/UVPUt/

	fire some events so we can start things sanely, like the polling

	figure out where not_accessible.png is used asset_map.inc:470 (permissions)
		'parameter.url.notaccessibleicon'	=> 'asset_map/not_accessible.png',
		'parameter.url.type2icon'			=> 'asset_map/not_visible.png',

	consistency
		sometimes we're passing around raw DOM, other times jQuery object
		sometimes we're passing around a.asset_name other times an li

	teleport

*/


(function ($, undefined) {
	// - check for multiple inclusions
	// see http://www.nczonline.net/blog/2010/07/27/determining-if-an-object-property-exists/
	if (
		'squiz' in $ &&
		'matrix' in $.squiz &&
		'assetMap' in $.squiz.matrix
	) return;


	// this is the main matrix object
	function matrix() {
		// TODO allow overriding
		this.debug = true;
//		this.debug = false;

		this.defaults = {
			// see AssetMap.java:246
			refreshInterval: 2000, // milliseconds
			adminSuffix: '_admin/', // don't fuck this up, xhr doesn't follow redirects
			fetchLimit: 150,
			lib: '__lib',
			plugins: []
		}
	}

	// - create namespaces
	// TODO discuss with labs what namespaces we can use ongoing
	$.squiz = $.squiz || {};
	$.squiz.matrix = $.squiz.matrix || new matrix();

	var sq_matrix = $.squiz.matrix;

	// - utility functions

	// see http://nelsonwells.net/2011/10/swap-object-key-and-values-in-javascript/
	// invert the keys/values of a map and return a map of values/keys (collisions not accounted for)
	var invert = function (obj) {
		var new_obj = {};

		for (var prop in obj) {
			if(obj.hasOwnProperty(prop)) {
				new_obj[obj[prop]] = prop;
			}
		}

		return new_obj;
	};


	// see http://stackoverflow.com/questions/1353408/messageformat-in-javascript-parameters-in-localized-ui-strings
	// expand a string similar to python
	var replaceParams = function replaceParams(string, replacements) {
		return string.replace(/\{(\d+)\}/g, function() {
			return replacements[arguments[1]];
		});
	};


	// see http://stackoverflow.com/questions/1720320/how-to-dynamically-create-css-class-in-javascript-and-apply
	function createCSSRule(selector, style) {
		if (!document.styleSheets) {
			return;
		}

		if (document.getElementsByTagName("head").length == 0) {
			return;
		}

		var styleSheet;
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


	$.extend($.contextMenu.defaults, {
		// bumping this up to cover the "hidden" (type_2 link) asset icon
		zIndex: 2
	});


	// construction of context menus
	var buildContextMenus = function buildContextMenus($map, $matrix) {

//$map = $map.get_container();
//console.log($map);
		// commonly used for context menus
		// In all context menus on the tree we're going to try to target the
		// LI element for the tree node as it contains all relevant information
		// for that asset (and tree behaviour)

		var defaultContextEvents = {
			show: function(options) {
				// store the node that was clicked
				options.$target = this.closest('li');
console.log('options.$target', options);
			},
			hide: function(options) {
				// this is called in addition to the command callback
				// so in the command callback we unset the target to
				// indicate our work is done, otherwise we want to keep the
				// mode the same
				if (!options.$target) {
console.log('context menu hide changing map mode from', $map.mode.current);
					$map.mode.change($map.mode.normal);
				}
			}
		};


		// context menu for move/link/clone
		$map.menuSelectors['select'] = function() { return $('li.jstree-leaf', $map.get_container().selector); };
//console.log('selector', $map.menuSelectors['select']().selector);
		$.contextMenu({
			selector: $map.menuSelectors['select']().selector,
			trigger: 'none',
			disabled: true,
			events: $.extend({}, defaultContextEvents, {
				hide: function(options) {
					$map.mode.change($map.mode.normal);
				}
			}),
			callback: function(key, options) {
console.log('stuff to do stuff with');
console.log($map.dnd_info);
				var t = $.jstree._reference($map.selector);
console.log('info', t.data.dnd);
			},
			items: {
				move: {
					name: sq_backend.translate('asset_map_menu_move_here')
				},
				newlink: {
					name: sq_backend.translate('asset_map_menu_link_here')
				},
				clone: {
					name: sq_backend.translate('asset_map_menu_clone_here'),
					disabled: true
				},
				sep: '-',
				cancel: {
					name: sq_backend.translate('asset_map_menu_cancel')
//					callback: function(key, options) {
//						$map.mode.change(1);
//					}
				}
			}
		});


		// common function for useme result
		var usemeItems = {
			useme: {
				name: sq_backend.translate('asset_map_menu_useme'),
				callback: function usemeCallback(key, options) {
					if (!options.$target) {
						alert('Bad state - no target!');
					}

console.log('selector', options.selector);
console.log('target', options.$target);

					var attrs = options.$target.get(0).attributes;
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
//							getUrl(attrs.getNamedItem('url').value, attrs.getNamedItem('web_path').value),
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
//		$map.menuSelectors['useme-li'] = $map.selector + ' li';
		$map.menuSelectors['useme-li'] = function() { return $('li', $map.get_container().selector); };
		$.contextMenu({
			// TODO need to allow expansion when this is active
			selector: $map.menuSelectors['useme-li']().selector,
			trigger: 'right',
			disabled: true,
			events: $.extend({}, defaultContextEvents, {
				show: function(options) { // override the default above
					// store the node that was clicked (jQuery)
					options.$target = this;
				}
			}),
			items: usemeItems
		});

		// context menu for useme via left click
//		$map.menuSelectors['useme-name'] = $map.selector + ' a.asset_name';
		$map.menuSelectors['useme-name'] = function() { return $('a.asset_name', $map.get_container().selector); };
		$.contextMenu({
			// TODO need to allow expansion when this is active
			selector: $map.menuSelectors['useme-name']().selector,
			trigger: 'right',
			disabled: true,
			items: usemeItems,
			events: $.extend({}, defaultContextEvents)
		});


//		$map.menuSelectors['asset'] = $map.selector + ' li[assetid] a';
		$map.menuSelectors['asset'] = function() { return $('li[assetid] a', $map.get_container().selector); };
		$.contextMenu({
			selector: $map.menuSelectors['asset']().selector,
			trigger: 'right',
			build: function($trigger, e) {
				var $asset = $trigger.parent('li[assetid]');
				var items = sq_asset.assetScreens[$asset.attr('type_code')];


console.log(arguments);
				if ($trigger.is('.jstree-clicked')) {
					return {
						callback: function(key, options) {
console.log('asset context callback', this, arguments, $trigger);

							// start the main drag/drop
							// see jquery.jstree.js:2199
//							$.vakata.dnd.is_down = true;
//							$.vakata.dnd.helper = $('<div id="vakata-dragged" />').html('<ins class="jstree-icon"></ins>');
//							$.vakata.dnd.user_data = { jstree : true, obj : key };
//							$(document).bind('mousemove', $.vakata.dnd.drag);

							// init drag/drop on the tree
//							$(document).trigger('drag_start.vakata', {
//								event: {
//									// TODO target likely wrong
//									target: key
//								},
//								data: $.vakata.dnd.user_data
//							});

//							var t = $.jstree._reference('#asset_map');
							var t = $map.jstree;
							var s = t.data.ui.selected;
							var p = s.offset();
							var e = $.Event('mousemove', {
								currentTarget: options.trigger,
								target: s,
								pageX: p.left,
								pageY: p.top
							});
							t.start_drag(options.trigger, e);

							t.get_container()
								// remove old handlers
								.undelegate('a', 'mousedown')
								.one('mousedown', $.proxy(function(e) {
console.log('attempt to drop', this, arguments);
									e.preventDefault();

									// reinstate handler
									t.get_container()
										.delegate("a", "mousedown.jstree", $.proxy(function (e) {
											if(e.which === 1) {
												this.start_drag(e.currentTarget, e);
												return false;
											}
										}, t));

									return false;
								}, $map));
/*
								.delegate("a", "mousedown.jstree", $.proxy(function (e) {
										if(e.which === 1) {
//											this.start_drag(e.currentTarget, e);
//											return false;
											if($.vakata.dnd.is_drag && $.vakata.dnd.user_data.jstree && e.currentTarget === e.target && $.vakata.dnd.user_data.obj && $($.vakata.dnd.user_data.obj).length && $($.vakata.dnd.user_data.obj).parents(".jstree:eq(0)")[0] !== e.target) { // node should not be from the same tree
												var tr = $.jstree._reference(e.currentTarget), dc;
												if(tr.data.dnd.foreign) {
													dc = tr._get_settings().dnd.drag_check.call(this, { "o" : o, "r" : tr.get_container(), is_root : true });
													if(dc === true || dc.inside === true || dc.before === true || dc.after === true) {
														tr._get_settings().dnd.drag_finish.call(this, { "o" : o, "r" : tr.get_container(), is_root : true });
													}
												}
												else {
													tr.move_node(o, tr.get_container(), "last", e[tr._get_settings().dnd.copy_modifier + "Key"]);
												}
											}
										}
									}, this))
*/

							// TODO hook up drop on left click
						},
						items: {
							move: {
								name: sq_backend.translate('asset_map_menu_move')
							},
							newlink: {
								name: sq_backend.translate('asset_map_menu_link')
							},
							clone: {
								name: sq_backend.translate('asset_map_menu_clone'),
								disabled: true
							}
						}
					}
				}

				return {
					// requests for new children SHOULD BE handled automatically
					// we're just handling the first level of the menu (asset screens)
					callback: function(key, options) {
console.log('asset context callback', this, arguments);
						var screenUrl = sq_backend.getScreenUrl(key, $asset);
console.log(arguments, screenUrl);
						sq_ui.changeMain(screenUrl);
					},
					items: items
				}
			}
		});


//		$map.menuSelectors['main'] = $map.selector;
		$map.menuSelectors['main'] = function() { return $($map.get_container().selector); };
		$.contextMenu({
			selector: $map.menuSelectors['main']().selector,
			trigger: 'right',
			callback: function(key, options) {
console.log('main context callback', arguments);

				// TODO this should go into a useme type state
				// and allow selecting the parent of the new asset
				// see MatrixTree.java:1332

				// create a new asset at the root
				// TODO work out where this asset is being added
				// sq_assetMap.backend.createAsset(key, 1, undefined);
				sq_backend.createAsset(key, 1);
			},
			items: sq_asset.newMenuItems
		});

	}; // buildContextMenus

	// stub the main players
	// the ones that are functions are singletons
	// we're not going to bother with "private" members
	// as I believe that stifles innovation

	// this is comms back to the server
	var backend = function backend() {};
	// this is the (internal) representation of the asset tree
	var tree = function tree() {};
	// this is the UI "manager", it's responsible for
	// creating the UI trees and hooking up event handlers
	// the actual trees themselves are a separate object (jstree)
	var ui = function ui() {};

	// this is mostly static information
	var asset = function asset() {
		this.status = {
			1: 'archived',
			2: 'underConstruction',
			4: 'pendingApproval',
			8: 'approvedToGoLive',
			16: 'live',
			32: 'upForReview',
			64: 'safeEdit',
			128: 'safeEditPendingApproval',
			256: 'safeEditApprovedToGoLive'
		};
	};


	// shortcuts for the main players
	var sq_backend = $.squiz.matrix.backend = new backend();
	var sq_tree = $.squiz.matrix.tree = new tree();
	var sq_ui = $.squiz.matrix.ui = new ui();
	var sq_asset = $.squiz.matrix.asset = new asset();

	$.extend(asset.prototype, {
		// handy
		statusByName: invert($.squiz.matrix.asset.status),

		// the menu items for "new asset"
		newMenuItems: {},

		// this stores the context menu items for asset types
		// we're storing the menu details here because they'll be built dynamically
		// and this gives us the flexibility to add/remove types etc without reload
		assetScreens: {},

		// different types of assets, used to define the types for the trees
		// TODO should be in sq_asset
		assetTypes: {},

		initialiseTypes: function initialiseTypes($xml) {
			// used in jQuery callbacks
			var that = this;

			// the menu items
			var items = this.newMenuItems = {};

			// We need to order the types by their type_codes
			// see MatrixMenus.java:369

			// an array of type names for sorting
			var types = [];
			// a map of arrays of type names for sorting
			var subTypes = {};

			// handle the action of a new asset
			var newAssetCallback = function(key, options) {
				// default add to tree root
// TODO we have many maps now
//				var $parent = $(sq_assetMap.selector + ' li[assetid=1]');
				var $parent = $(sq_assetMap.selector + ' li[assetid=1]');
				var $this = $(this);

				// we clicked on an asset
				if ($this.parent('li[assetid]').length) {
					$parent = $this.parent('li[assetid]');
				}

				// if options.$trigger is not a jquery then we're adding to the tree root
				sq_backend.createAsset(key, $parent/*, parentPosition*/);
			}

			// Check each type that we find
			$xml.find('type').each(function() {
				var $this = $(this);

				var path = $this.attr('flash_menu_path');
				var type = $this.attr('type_code');

				// get screens (context menu items)
				// TODO order these
				var m = that.assetScreens[type] = {};
				var mIndex = 0;
				$this.find('screen').each(function() {
					m[$(this).attr('code_name')] = {
						name: $(this).text(),
						index: mIndex++
					}
				});

				// store the type info for the tree
				// see http://www.jstree.com/documentation/types
				that.assetTypes[type] = {
					icon: {
						image: sq_backend.getIconUrl(type)
					},
					hover_node: false
				};

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
						info: $this,
						callback: newAssetCallback
					};
					// info for sorting
					subTypes[path].push(unescape($this.attr('name')));

					// construct an icon style
//						sq_assetMap.util.createCSSRule(type);
					sq_backend.createIconCSS(type);
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
				icon: 'folder',
				callback: newAssetCallback
			};
			items['order'].push('sep');
			items['order'].push('folder');

			// preferring to do the folder CSS here because the base URL can change
//				sq_assetMap.util.createCSSRule('folder');
			sq_backend.createIconCSS('folder');


			// common bits on each types context menu
			var typeCommon = {
				sep: '-',
				teleport: {
					name: sq_backend.translate('asset_map_menu_teleport'),
					disabled: true
				},
				refresh: {
					name: sq_backend.translate('asset_map_menu_refresh'),
					callback: function(key, options) {
console.log('TODO refreshing something')
					},
					disabled: true
				},
				// TODO this item needs to be replaced after an asset has been
				// created
				prev: {
					name: sq_backend.translate('asset_map_menu_no_previous_child'),
					disabled: true,
					callback: function(key, options) {
console.log('This needs to be populated with the entry from the most recently created child');
					}
				},
				'new': {
					name: 'New Child',
					items: items
				}
			};

			// create context menus for each asset type
			$.each(this.assetScreens, function(k, v) {
				$.extend(v, typeCommon);
			});

// globally indicate that initialisation has been fired
// TODO I think this is handled differently now
init_fired = true;

			// see http://forum.jquery.com/topic/triggering-custom-events-on-js-objects
			$(sq_ui).triggerHandler('typesLoaded.squiz', {
//			sq_ui.triggerHandler('typesLoaded.assetMap', {
				types: that.assetTypes
			});

		}


	});

//	if ($.squiz.matrix.debug) {
//		console.log('sq_backend', $.squiz.matrix.backend);
//		console.log('sq_tree', $.squiz.matrix.tree);
//		console.log('sq_ui', $.squiz.matrix.ui);
//		console.log('sq_asset', $.squiz.matrix.asset);
//	}

	// fill out the main players

	$.extend(true, backend.prototype, {
		debug: false,
//		debug: true,

		// TODO allow overriding this
		locale: 'en_AU',

		// url creation/manipulation

		// TODO work out our path better
		url: location.protocol + '//' + location.host + '/',

		// default URL parameters
		params: {
			SQ_ACTION: 'asset_map_request',
			XDEBUG_SESSION_START: 'netbeans-xdebug'
		},

		getUrl: function getUrl(path, params) {
			return this.url + (path || '') + '?' + $.param($.extend(
				{},
				this.params,
				params || {}
			))
		},

		// simple replacement, relevant to base url
		// TODO test this with a sub-path "install"
		getIconUrl: function getIconUrl(assetType) {
			return this.getUrl('/__data/asset_types/' + assetType + '/icon.png');
		},

		// construct some CSS for the assetMap
		createIconCSS: function createIconCSS(assetType) {
			createCSSRule('.context-menu-item.icon-' + assetType, 'background-image: url(' + this.getIconUrl(assetType) + ');');
		},

		// TODO make asset an object
		getScreenUrl: function getScreenUrl(screen, asset) {
			// see MatrixMenus.java:147
//					Matrix.getProperty("parameter.url.baseurl") +
//					Matrix.getProperty("parameter.backendsuffix") +
//					"/?SQ_BACKEND_PAGE=main&backend_section=" +
//					"am&am_section=edit_asset&assetid=" + assetid +
//					"&sq_asset_path=" + assetPath + "&sq_link_path=" +
//					linkPath + "&asset_ei_screen=" + screenName;
console.log('asset', asset);

			// TODO get the link path which is a comma separated list of link
			// ids up to the root
			// TODO get the asset path which is a comma separated list of asset
			// ids up to the root

			// TODO get backendsuffix from somewhere
			return this.getUrl(sq_matrix.defaults.adminSuffix, {
				SQ_BACKEND_PAGE: 'main',
				backend_secion: 'am',
				am_section: 'edit_asset',
				assetid: asset.attr('assetid'),
				sq_asset_path: asset.attr('path'),
				sq_link_path: asset.attr('linkid'),
				asset_ei_screen: screen,
				SQ_ACTION: null // override the default SQ_ACTION (asset_map_request)
			});
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
				case 'get url':
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
					if (this.debug) {
						console.log('Doing nothing for command', arguments);
					}
				break;
			}

			if (this.debug) {
				console.log('getCommand XML:', xml);
			}

			return xml;
		},
		// first argument is action, second is object containing command attributes
		// third is an array of children
		getCommandXML: function getCommandXML(action, params, children) {
//console.log(this);
			var command = this.getCommand(action, params, children);
			// see http://joncom.be/code/javascript-xml-conversion/
			command = window.ActiveXObject ? command.xml : (new XMLSerializer()).serializeToString(command);
			if (this.debug) {
				console.log('getCommandXML command:', command);
			}
			return command;
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

			sq_assetMap.mode.change(1);

			$.ajax({
				url: this.getUrl(sq_matrix.defaults.adminSuffix),
				type: 'POST',
				processData: false,
				data: sq_assetMap.util.getCommandXML(action, {
					to_parent_assetid: $target.find('a.asset_name').attr('assetid'),
					to_parent_pos: 0 // TODO positional selection
				}, args),
				contentType: "text/xml",
				dataType: 'xml',
				error: function (XMLHttpRequest, textStatus, errorThrown) {
					console.log(XMLHttpRequest, textStatus, errorThrown);
				},
				success: function(xml) {
console.log(xml);
					var url = $(xml).find('url[js_function=asset_map_popup]').text();
					url && open_hipo(url);
				}
			});
		},
		moveAssets: function(assets, $target) {
			sq_assetMap.backend._handleAssets('move asset', assets, $target);
		},
		linkAssets: function(assets, $target) {
			sq_assetMap.backend._handleAssets('new link', assets, $target);
		},
		cloneAssets: function(assets, $target) {
			sq_assetMap.backend._handleAssets('clone', assets, $target);
		},
		// see MatrixTreeComm:61
		createAsset: function(type, $parent, parentPosition) {
			// see MatrixTree.java:1596:1689 for the -1 option
			parentPosition = parentPosition || -1;

			// <command action="get url" cmd="add" parent_assetid="1" pos="6" type_code="folder" />

			$.ajax({
				url: this.getUrl(sq_matrix.defaults.adminSuffix),
				type: 'POST',
				processData: false,
				data: this.getCommandXML('get url', {
					parent_assetid: $parent.attr('assetid'),
					pos: parentPosition,
					cmd: 'add',
					type_code: type
				}),
				contentType: "text/xml",
				dataType: 'xml',
				error: function (XMLHttpRequest, textStatus, errorThrown) {
					console.log(XMLHttpRequest, textStatus, errorThrown);
				},
				success: function(xml) {
					var url = $(xml).find('url[frame=sq_main]').text();
					url && sq_ui.changeMain(url);
				}
			});
		},

		// translation

		// needs an explanation?
		translate: function translate() {
			if (this.debug) {
				console.log('translating', arguments);
			}
			// see Matrix.java:55
			var translation = this.translationData[this.locale][arguments[0]];

			if (!translation) return arguments[0];
			if (arguments.length > 1) {
				return replaceParams(translation, [].splice.call(arguments, 1));
			}

			return translation;
		},

		// TODO this needs be initialised with at least $map.locale
		// see XXX for initialisation
		translationData: {},

		// prep translation data
		initialiseTranslation: function initialiseTranslation($xml) {
			var info = {};

			$.each($xml.text().split("\n"), function(i, trans) {
				if (!trans) return;
				// TODO I think this can be made a bit better...
				// though it needs discussion with core devs and translation maintainers
				var bits = trans.match(/([^=]+[^ ]) *= *([^ ]*.*)/);
				if (bits && bits.length)
					info[bits[1]] = bits[2];
			});

			if (this.debug) {
				console.log('Translation data for', $xml.attr('locale'), info);
			}

			this.translationData[$xml.attr('locale')] = info;
		}
	});


	// this is the object that stores the tree state
	$.extend(true, tree.prototype, {
		// TODO allow overriding
//		debug: true,
		debug: false,

		model: {
			// root of the tree
			assetid: 1,
			parent: undefined,
			attr: {
				assetid: 1
			},

			// this is the only "artificial" property (for now)
			_children: [],
			uniqueId: String(Math.random()).replace(/\D/g, '')
		},

		// TODO add the root node to this
		allNodes: {},

		// keep track of when initialisation has started, to allow queueing
		// of clients awaiting a response
		_initialisationStarted: false,
		_initialisationCallbacks: [],
		_initialisationFinished: false,

		// this decouples the ajax requests from the operations to process their
		// data, allowing other means to initialise the asset map
		initialise: function initialise(callback) {
//console.log(this.backend, sq_backend);
			if (this._initialisationFinished) {
				// see Operators on http://javascript.crockford.com/survey.html
				return callback && callback();
			}
			else {
				$(sq_backend).bind('init.assetMap', callback);

				// don't initialise twice
				if (this._initialisationStarted) {
					return;
				}
			}

			this._initialisationStarted = true;
			var that = this;

			$.ajax({
				url: sq_backend.getUrl(sq_matrix.adminSuffix),
				type: 'POST',
				processData: false,
				data: sq_backend.getCommandXML('get translations'),
				contentType: "text/xml",
				dataType: 'xml',
				error: function (XMLHttpRequest, textStatus, errorThrown) {
console.log(XMLHttpRequest, textStatus, errorThrown);
				},
				success: function(xml) {
					sq_backend.initialiseTranslation($(xml).find('translations'));
				},
				complete: function() {
					$.ajax({
						url: sq_backend.getUrl(sq_matrix.adminSuffix),
						type: 'POST',
						processData: false,
						data: sq_backend.getCommandXML('initialise'),
						contentType: "text/xml",
						dataType: 'xml',
						error: function (XMLHttpRequest, textStatus, errorThrown) {
console.log(XMLHttpRequest, textStatus, errorThrown);
						},
						success: function(xml) {
//console.log('success', arguments);
							if (that.debug) {
								console.log('Initialising types', xml);
							}

							sq_asset.initialiseTypes($(xml).find('asset_types'));

							// references to other containers for resizing
							var $cResizer = $('#sq_resizer');
							var $cMain = $('#container_main');
							var $assetMap = $(this.selector);

							// TODO teleport may be relevant here
//							sq_tree._buildBranch(undefined, $(xml).find('assets'));
							sq_tree._buildBranch($(that.model), $(xml).find('assets'));

							$(sq_backend).triggerHandler('init.assetMap', {$xml: $(xml).find('assets')});
						}
					});
				}
			});
		},

		_buildBranch: function($root, $xml, callback) {
			if (this.debug) {
				console.log('_buildBranch', arguments);
			}

			// this is to control how we deal with the different values when we attach them to the dom
			var handlers = {
				integer: function(input) { return parseInt(input, 10); },
				string: function(input) { return unescape(input.replace(/\+/g, ' ')); },
				'default': function(input) { return input; }
			};

			// these are the fields we know about
			var fields = {
				assetid: handlers.string,
				link_type: handlers.integer,
				name: handlers.string,
				num_kids: handlers.integer,
				sort_order: handlers.integer,
				type_code: handlers.string,
				url: handlers.string
			};

			// Normalise a field value
			var getField = function(asset, fieldName) {
				return fields[fieldName] ? fields[fieldName](asset.attr(fieldName)) : asset.attr(fieldName);
			}

			// let the UIs know that we're loading a branch
			$(sq_ui).triggerHandler('nodeLoading.assetMap', {
				root: $root
			});
var modelRoot = this.findNode($root);
if (!modelRoot) {
	console.log('Cannot find model node for branch at', $root);
	return;
}

			// Check each asset that we find
			var that = this;
			$xml.find('asset').each(function() {
				var $asset = $(this);

				// don't add ourself as a child of ourself (seen it happen in the case of the trash)
				// we comparison to catch numbers vs letters
				if ($root.attr('assetid') == $(this).attr('assetid')) {
//console.log('_buildBranch skipping root asset', $asset);
					return;
				}
				else if (that.debug) {
					console.log('processing node', this);
				}

				if (this.attributes.length) {
					// record our parent
					// TODO why are we using our parents parent?
//					$asset.attr('parentid', $root.assetid || $root.parent);
					$asset.attr('parentid', $root.attr('assetid'));

					// these is used in jstree
					var info = {
						data: getField($asset, 'name'),
						attr: {
							// see http://stackoverflow.com/questions/6105905/drag-and-drop-events-in-dnd-plugin-in-jstree-are-not-getting-called
							'class': 'jstree-drop'
						},
						state: getField($asset, 'num_kids') > 0 ? 'closed' : undefined
					};

					// these are used to manage the model of the tree
					// TODO this is bad, should consider using prop or data instead to store the values
					// see http://api.jquery.com/prop/
					$.each(this.attributes, function(i, attr) {
						info.attr[attr.name] = getField($asset, attr.name);
					});
					// allow some children
					info._children = [];
					// see https://github.com/jquery/jquery/blob/master/src/data.js#L191
					info.uniqueId = info.attr.uniqueId = String(Math.random()).replace(/\D/g, '');

					// add it to the tree
					// TODO fire an event
					// be able to detect when this happened via a refresh
					// or an open event (given the granularity of the event)
that.allNodes[info.uniqueId] = info;
//console.log($root, $root.get(0));
//					$root.get(0)._children.push(info);
modelRoot._children.push(info);



					// TODO do we need to make this asynchronous
//					setTimeout(function() {
						$(sq_ui).triggerHandler('nodeLoaded.assetMap', {
							$root: $root,
							node: info
						});
//					}, 0);

				}
			});

			callback && callback();
		},

		// $current_asset is a model entry, not wrapped in jQuery
		_getChildren: function($current_asset, replace, callback) {
			if (this.debug) {
				console.log('_getChildren', arguments);
			}

			// are we replacing the contents?
			replace = replace || false;

			// Construct our XML to send
			xml_get = sq_backend.getCommandXML('get assets', {}, [{
				assetid: $current_asset.attr('assetid'),
				start: 0,
//				limit: sq_assetMap.params.fetchLimit,
				limit: sq_ui.defaults.fetchLimit,
				linkid: $current_asset.attr('linkid')
			}]);

			// for removing the loading indicator
			var cls = 'loading' + String(Math.random()).replace(/\D/g, '');

			// Create our ajax to send the XML
			$.ajax({
				url: sq_backend.getUrl(),
				type: 'POST',
				processData: false,
				data: xml_get,
				contentType: "text/xml",
				dataType: 'xml',
				error: function (XMLHttpRequest, textStatus, errorThrown) {
console.log(XMLHttpRequest, textStatus, errorThrown);
				},
				beforeSend: function () {
					$current_asset
						.children('a')
						.append($('<img class="loading ' + cls + '" src="/dev/325.1.gif" width="12" height="12"></img>'));
				},
				success: function(xml) {
					sq_tree._buildBranch($current_asset, $(xml), callback);
				},
				complete: function() {
					// Remove loading indicator
					$('.' + cls, $current_asset).remove();
				}
			});

		},

		// called whenever a branch is opened
		// determines whether we need to go back to the server or not
		// arguments:
		// node -
		openBranch: function(node, callback) {
			this._getChildren(node, false, callback);
		},

		// this is horribly inefficient - look into flat storage with uniqueId
		findNode: function($domNode, root) {
			root = root || this.model;
			var found = false;

			// check ourselves
			if (root.attr.assetid == $domNode.attr('assetid')) {
				return root;
			}

			// check our children
			for (var i = 0; i < root._children.length; i++) {
				found = this.findNode($domNode, root._children[i]);
				if (found){
					break;
				}
			}

			return found;
		}
	});

	$.extend(true, ui.prototype, {
		defaults: {
			// see AssetMap.java:246
			refreshInterval: 2000, // milliseconds
//			adminSuffix: '_admin/', // don't fuck this up, xhr doesn't follow redirects
			fetchLimit: 150,
			lib: '__lib',
			plugins: []
		},

		// change the contents of the main screen
		// see AssetMap.java:74
		changeMain: function (url) {
			if (this.debug) {
				console.log('changeMain opening', url);
			}

			// here window refers to top.frames['sq_sidenav']
			window.frames['sq_main'].location = url;
		},

		// stolen from jstree
		_reference: function(needle) {
			// get by instance id
			if(instances[needle]) {
				return instances[needle];
			}

			if (needle instanceof $.jstree._instance) {
				for (var i = 0; i < instances.length; i++) {
					if (instances[i].jstree === needle) return instances[i];
				}
			}

			// get by DOM (if still no luck - return null
			var o = $(needle);


			if (!o.length && typeof needle === "string") {
				// attempt search by ID
				o = $("#" + needle);
			}

			if (!o.length) {
				return null;
			}

			return instances[o.closest(".assetMap").data("assetmap_instance_id")] || null;
		},

		// called when asked to locate as asset (ie, binoculars)
		// always happens on first tree
		locateAsset: function(info, callback) {
			// TODO better instance selection
			instances[0].locateAsset(info, callback);
		}
	});
//console.log('ui', ui.prototype);
//console.log('ui', sq_ui);
//console.log('ui', $.squiz.matrix.ui);


	// ================================
	// Begin creation of map components
	// ================================

	// - variable to hold instances
	var instances = [],
		plugins = {}, // making things work
		init_fired = false;

	// - expose jquery method
	// copied & modified from jstree
	$.fn.matrixTree = function( settings ) {
		var isMethodCall = (typeof settings == 'string'), // is this a method call like $().jstree("open_node")
			args = Array.prototype.slice.call(arguments, 1),
			returnValue = this;

		// if a method call execute the method on all selected instances
		if(isMethodCall) {
			// protection for 'private' methods
			if(settings.substring(0, 1) == '_') { return returnValue; }
			this.each(function() {
				var instance = instances[$.data(this, "assetmap_instance_id")],
					methodValue = (instance && $.isFunction(instance[settings])) ? instance[settings].apply(instance, args) : instance;
					if(typeof methodValue !== "undefined" && (settings.indexOf("is_") === 0 || (methodValue !== true && methodValue !== false))) { returnValue = methodValue; return false; }
			});
		}
		else {
			// there can only be one created at a time as we use
			// the selector for controlling menus
			if (this.length > 1) {
				alert('Can only create one map at a time, attempting to create ' + this.length + ' maps');
				return;
			}
			this.each(function() {
				// extend settings and allow for multiple hashes and $.data
				var instance_id = $.data(this, "assetmap_instance_id"),
					a = [],
					b = settings ? $.extend({}, true, settings) : {},
					c = $(this),
					s = false,
					t = [];
				a = a.concat(args);
				if(c.data("assetmap")) { a.push(c.data("assetmap")); }
				b = a.length ? $.extend.apply(null, [true, b].concat(a)) : b;

				// if an instance already exists, destroy it first
				if(typeof instance_id !== "undefined" && instances[instance_id]) { instances[instance_id].destroy(); }
				// push a new empty object to the instances array
				instance_id = parseInt(instances.push({}),10) - 1;
				// store the jstree instance id to the container element
				$.data(this, "assetmap_instance_id", instance_id);

				// clean up all plugins
				b.plugins = $.isArray(b.plugins) ? b.plugins : sq_ui.defaults.plugins.slice();
				b.plugins.unshift("core");
				// only unique plugins
				b.plugins = b.plugins.sort().join(",,").replace(/(,|^)([^,]+)(,,\2)+(,|$)/g,"$1$2$4").replace(/,,+/g,",").replace(/,$/,"").split(",");

				// extend defaults with passed data
				s = $.extend(true, {}, sq_ui.defaults, b);
				s.plugins = b.plugins;
				$.each(plugins, function (i, val) {
					if($.inArray(i, s.plugins) === -1) { s[i] = null; delete s[i]; }
					else { t.push(i); }
				});
				s.plugins = t;

				// push the new object to the instances array (at the same time set the default classes to the container) and init
//				instances[instance_id] = new $.squiz.matrix.assetMap._instance(instance_id, $(this).addClass("assetMap assetMap-" + instance_id), s);
//				instances[instance_id] = new $.squiz.matrix.assetMap(instance_id, $(this).addClass("assetMap assetMap-" + instance_id), s);
//				instances[instance_id] = new assetMap(instance_id, $(this).addClass("assetMap assetMap-" + instance_id), s);
				instances[instance_id] = new assetMap(instance_id, returnValue.addClass("assetMap assetMap-" + instance_id), s);

				// init all activated plugins for this instance
//				$.each(instances[instance_id]._get_settings().plugins, function (i, val) { instances[instance_id].data[val] = {}; });
//				$.each(instances[instance_id]._get_settings().plugins, function (i, val) { if(plugins[val]) { plugins[val].__init.apply(instances[instance_id]); } });
				// initialize the instance
//				setTimeout(function() { if(instances[instance_id]) { instances[instance_id].initialise(); } }, 0);
			});
		}

		// return the jquery selection (or if it was a method call that returned a value - the returned value)
		return returnValue;
	};
/*
	// TODO investigate a recommended plugin pattern
	// perhaps jQuery-UI

	// see http://docs.jquery.com/Plugins/Authoring#Namespacing
	$.fn.matrixTree = function( method ) {
		if ( tree[method] ) {
			return tree[method].apply( this, Array.prototype.slice.call( arguments, 1 ));
		}
		else if ( typeof method === 'object' || ! method ) {
			return tree.init.apply( this, arguments );
		}
		else {
			$.error( 'Method ' +  method + ' does not exist on jQuery.matrixTree' );
		}
	};
*/




/*
	// - singleton, exposed methods
	// asset information - probably static
	var sq_asset = $.squiz.matrix.asset = {
		status: {
			1: 'archived',
			2: 'underConstruction',
			4: 'pendingApproval',
			8: 'approvedToGoLive',
			16: 'live',
			32: 'upForReview',
			64: 'safeEdit',
			128: 'safeEditPendingApproval',
			256: 'safeEditApprovedToGoLive'
		}
		// add more awesomeness here
	};
	// create a reference to go the other way
	sq_asset.statusByName = invert(sq_asset.status);
*/

	// TODO what is this for?
	var sq_assetMap = $.squiz.matrix.assetMap = (new function(){}());


	// - singleton, exposed methods
	// the assetMap
	// using a jquery object so we can bind events to it
	// see http://stackoverflow.com/questions/1553342/custom-event-in-jquery-that-isnt-bound-to-a-dom-element
//	var sq_assetMap = $.squiz.matrix.assetMap = $('<div/>');
//	var sq_assetMap = $.squiz.matrix.assetMap = {
	function assetMap(index, container, settings) {
		settings = $.extend({}, this.defaults, settings);
		// for plugins to store data in
		this.data = { core : {} };
		this.get_settings	= function () { return $.extend(true, {}, settings); };
		this._get_settings	= function () { return settings; };
		this.get_index		= function () { return index; };
		this.get_container	= function () { return container; };
//		this.get_container_ul = function () { return container.children("ul:eq(0)"); };
		this._set_settings	= function (s) {
			settings = $.extend(true, {}, settings, s);
		};

		this.menuSelectors = {};


		// TODO construction/handler setup of tree should be handled by ui?

		// doing synchronous stuff here would be sweet, however we're assuming
		// that browsers won't play ball so let's do it via callback

		sq_tree.initialise($.proxy(function() {
console.log('types are loaded, doing stuff with an assetMap');

			// need to load all existing nodes (below teleport)
			// and listen to new nodes added
//			loadTreeUI.apply(this, [container]);
			// TODO move loadTreeUI into initialise
			this.initialise();

			// TODO race condition here with initialisation
			$(sq_ui).bind('nodeLoaded.assetMap', $.proxy(function(event, data) {
//console.log('adding new node to', this, arguments);
//console.trace();

				// TODO probably not the best location for this
				// jstree will open a parent node when you add a child,
				// and we're listening to 'open_node.jstree' and firing
				// a request to the server - however when using the goggles
				// the request has already happened
				// setting hasOpened == 'true' avoids a second request
				data.$root.attr('hasOpened', 'true');

//				this.get_container().jstree('create', data.$root, data.node.attr['sort_order'] || 'inside', data.node, false, true);
				this.jstree.create(data.$root, data.node.attr['sort_order'] || 'inside', data.node, false, true);
			}, this));

		}, this));
/*
		// if we haven't initialised yet, let's kick that off, otherwise
		// we just need to hook up our handlers
		if (sq_tree.inititialise()) {
console.log('types already loaded, doing stuff with an assetMap');
		}
		else {
			// let's do the initialisation dance
			sq_tree.initialise();

			var that = this;
			$(sq_ui).bind('typesLoaded.squiz', function(event, data) {
				console.log('types are loaded, doing stuff with an assetMap');
			});
		}
*/
	};
/*
	var sq_assetMap = $.squiz.matrix.assetMap = new assetMap(index, container, settings) {
		settings = $.extend({}, sq_assetMap.defaults, settings);
		// for plugins to store data in
		this.data = { core : {} };
		this.get_settings	= function () { return $.extend(true, {}, settings); };
		this._get_settings	= function () { return settings; };
		this.get_index		= function () { return index; };
		this.get_container	= function () { return container; };
		this.get_container_ul = function () { return container.children("ul:eq(0)"); };
		this._set_settings	= function (s) {
			settings = $.extend(true, {}, settings, s);
		};
	}();
*/
	$.extend(true, assetMap.prototype, {
		debug: true,
/*
		defaults: {
			// see AssetMap.java:246
			refreshInterval: 2000, // milliseconds
			adminSuffix: '_admin/', // don't fuck this up, xhr doesn't follow redirects
			fetchLimit: 150,
			lib: '__lib',
			plugins: []
		},
*/
		// TODO get this from elsewhere
		// used for translation
//		locale: 'en_AU',
/*
_instance : function (index, container, settings) {
	// for plugins to store data in
	this.data = { core : {} };
	this.get_settings	= function () { return $.extend(true, {}, settings); };
	this._get_settings	= function () { return settings; };
	this.get_index		= function () { return index; };
	this.get_container	= function () { return container; };
	this.get_container_ul = function () { return container.children("ul:eq(0)"); };
	this._set_settings	= function (s) {
		settings = $.extend(true, {}, settings, s);
	};
console.log('this', this);
},
*/

// this is done by 'instances'
//		trees: [],

		initialise: function() {

			function addExistingNodes(tree, root) {
				for (var i = 0; i < root._children.length; i++) {
//console.log('adding node', root._children[i], $('[uniqueId=' + root.uniqueId + ']').get());
					tree.jstree('create', $('[uniqueId=' + root.uniqueId + ']'), root._children[i].attr['sort_order'] || 'inside', root._children[i], false, true);

					if (root._children[i]._children.length) {
						addExistingNodes(tree, root._children[i]);
					}
				}
			}

			this
				.get_container()
				// load nodes after the root is available
				.bind("loaded.jstree", $.proxy(function (event, data) {
					addExistingNodes(this.get_container(), sq_tree.model);

					buildContextMenus(this);

					// enable context menus
					this._mode.normal.enter.call(this);
				}, this))
				.jstree({
					plugins:[
						'json_data',
						'crrm',
						'ui',
						'themes',
						'dnd',
						'types',
						'ui' // needed for selecting nodes via binoculars
					],
					core: {
						animation: 0
					},
					types: {
//						types: sq_assetMap.assetTypes,
						type_attr: 'type_code'
					},
					themes: {
						theme: "classic",
						dots: false,
						icons: true
					},
					json_data: {
						data: [
							{
								data: '/',
								state: 'closed',
								attr: {
									// TODO these may be different according to prefs/teleport
									assetid: 1,
//								uniqueId: sq_assetMap._tree.model.uniqueId
									uniqueId: sq_tree.model.uniqueId,
									type_code: 'root_folder'
								}
							}
						]
					},
					// see http://stackoverflow.com/questions/11000095/dnd-how-to-restrict-dropping-to-certain-node-types
					crrm: {
						move: {
							always_copy: "multitree", // false, true or "multitree"
							open_onmove: false,
							default_position: "last",
							check_move: function (m) {

								// we can check for valid parents here
								// potentially circumventing the "going to fail" hipo
	//								if(!m.np.hasClass("someClassInTarget")) return false;
	//								if(!m.o.hasClass("someClassInSource")) return false;
								return true;
							}
						}
					},
					dnd: {
						drag_finish: function(data) {
	console.log('drag_finish', arguments);
						},
						drop_finish: function(data) {
	console.log('drop_finish', arguments);
						}
//						drag_check: function (data) {
//console.log('drag_check', arguments);
//							return {
//								after : false,
//								before : false,
//								inside : true
//							};
//						}
					}
				})
				.bind("move_node.jstree", $.proxy(function(evt, data) {
console.log('move_node event', arguments);
					var t = this.jstree;
//					var t = $.jstree._reference(this);
					// we'll handle opening ourselves so we can control
					// the refresh better
					// see TODO
					data.rslt.np.parentsUntil(".jstree").andSelf().filter(".jstree-closed").each(function () {
						t.open_node(this, false, true);
					});
				}, this))
				// this is in the context of the tree
				.bind('open_node.jstree', function(evt, data) {
					if (sq_assetMap.debug) {
						console.log('open_node', arguments);
					}

					// this is a lame way to get to the element
					// data.args[0] needs wrapping due to opening via dnd
					var $node = $(data.args[0]);

					if ($node.attr('assetid') === '1') {
						console.log('Not fetching root node contents');
						return;
					}
///console.log('checking for open', $node);
					// check to see if we've already got our children
					// this is broken when we're asked to open via dnd
	//					if ($node.find('ul').length) return;

					// avoid opening twice
					// attributes are string values (even if you set them as booleans)
					if ($node.attr('hasOpened') === 'true') {
//console.log('Not reloading an already opened node', $node);
						return;
					}

					$node.attr('hasOpened', 'true');

					// expand this branch
					// sq_tree takes arguments that are part of the model
	//				var modelNode = sq_tree.findNode(data.args[0]);
	//				if (!modelNode) {
	//					console.log('Cannot find model node for tree node', data.args[0]);
	//				}
	//				sq_tree.openBranch($(modelNode));
					sq_tree.openBranch(data.args[0]);

	//				get_children(null, false, data.args[0]);
				})
				// this is to detect when we've programmatically started
				// dnd, and we want to finish
				// see jstree:2434
				.bind('mousedown.sqtree', $.proxy(function(evt) {
					var t = this.jstree;

					// this is too blunt - want to close branches while in dnd
					if($.vakata.dnd.is_drag && $.vakata.dnd.user_data.jstree) {
						$.vakata.dnd.drag_stop({});
						t.dnd_finish(evt);
					}
				}, this));

			this.jstree = $.jstree._reference(this.get_container());
		},

		// various modes the map can be in, and the current mode
		// TODO this belongs in the tree
		mode: {
			normal: 1, // when nothing else is happening, a default state
			select: 2, // when you need to select a location for move/clone etc
			useme: 3, // when something from the main frame has asked for an assetId

			// the current mode
			// TODO a way to set a different mode at creation of a new tree
			// TODO this belongs to the tree (visual), not the map (model)
			current: 1
		},

		// the (recommended) way to change between map modes
		_mode: {
			// TODO we're passing the scope on here, so we'd better some up with
			// some rules about how to use it
			change: function(newMode) {
				if (!sq_assetMap.mode[newMode]) {
					alert('Invalid map mode requested: ' + newMode + '. This code needs fixing');
					return;
				}

				if (sq_assetMap.mode.current === newMode) {
					console.log('LAME! attempt to change to existing mode. This code needs fixing');
					console.trace();
					return;
				}

				if (sq_assetMap.debug) {
					console.log('exiting mode', sq_assetMap.mode.current);
				}
				sq_assetMap.mode[sq_assetMap.mode.current].exit.call(this);

				sq_assetMap.mode.current = newMode;

				if (sq_assetMap.debug) {
					console.log('entering mode', sq_assetMap.mode.current);
				}
				sq_assetMap.mode[sq_assetMap.mode.current].enter.call(this);
			},

			normal: {
				enter: function() {
console.log('enabling normal mode', this, this.menuSelectors);
					// enable the standard asset context menu
//					$(sq_assetMap.menuSelectors['asset']).contextMenu(true);
					this.menuSelectors['asset']().contextMenu(true);

					// this is in the case we press escape after entering another mode
					// reselect what might have been selected
//						sq_assetMap.selected = sq_assetMap.previousSelected;
//						sq_assetMap.previousSelected = [];

//						sq_assetMap._redrawSelected();
				},
				exit: function() {
					// disable the standard asset context menu
//					$(sq_assetMap.menuSelectors['asset']).contextMenu(false);
					this.menuSelectors['asset']().contextMenu(false);
				}
			},
			// TODO belongs in the tree
			select: {
				enter: function() {
					// start the trees drag 'n' drop
					// the tree
					var t = $.jstree._reference(sq_assetMap.selector);
					// currently selected
					var s = t.data.ui.selected;
					if (!s.length) return;

					// the position of the selected element, to initiate drag from
					// TODO could use the mouse position here
					var p = s.offset();

/*
					// a fake event to appease jstree
					var e = $.Event('mousemove', {
						currentTarget: s,
						target: s,
						pageX: p.left,
						pageY: p.top
					});

					// this it
					$.vakata.dnd.drag_start(e, {
							jstree: true,
							obj : t
						}, "<ins class='jstree-icon'></ins>" + $(e.target).text()
					);
*/
					t.start_drag(s, $.Event('mousemove', {
						currentTarget: s,
						pageX: p.left,
						pageY: p.top
					}));

					// drag_start enables this, so we'll undo that
					// see jstree:2206
					$(document).unbind("mouseup", $.vakata.dnd.drag_stop);

					// we also need to disable the starting of drag on a click so we
					// can handle the context popup correctly
					// see jstree:2389
					t.get_container().undelegate("a", "mousedown.jstree");

					// enable link/copy/clone context menu
//					$(sq_assetMap.menuSelectors['select']).contextMenu(true);
					this.menuSelectors['select']().contextMenu(true);
				},
				exit: function() {
					// disable link/copy/clone context menu
//					$(sq_assetMap.menuSelectors['select']).contextMenu(false);
					this.menuSelectors['select']().contextMenu(false);

					$.vakata.dnd.drag_stop({});

					// enable drag start again
					// see jstree:2389
					var t = $.jstree._reference(sq_assetMap.selector);
					t.get_container().delegate("a", "mousedown.jstree", $.proxy(function (e) {
console.log('custom mousedown', this);
						if(e.which === 1) {
							this.start_drag(e.currentTarget, e);
							return false;
						}
					}, t));

					// hide the markers
					// see jstree:2458
					// see jstree:2744
					if (t.dnd_expose().m) {
						t.dnd_expose().m
							.hide()
							.css({
								top: -2000
							});
					}
					if (t.dnd_expose().ml) {
						t.dnd_expose().ml
							.hide()
							.css({
								top: -2000
							});
					}
				}
			},
			useme: {
				enter: function() {
					$(sq_assetMap.selector).addClass('useme');

					// enable the "useme" context menus
					$(sq_assetMap.menuSelectors['useme-name']).contextMenu(true);
					$(sq_assetMap.menuSelectors['useme-li']).contextMenu(true);
				},
				exit: function() {
					$(sq_assetMap.selector).removeClass('useme');

					// disable the "useme" context menus
					$(sq_assetMap.menuSelectors['useme-name']).contextMenu(false);
					$(sq_assetMap.menuSelectors['useme-li']).contextMenu(false);
				}
			}
		},

		// store the selectors for the different menus to accurately enable/disable
//		menuSelectors: {},
		// see AssetMap.java:246
		checkRefresh: function checkRefresh() {
			if (sq_assetMap.debug) console.log('checking for refresh', new Date());
			// TODO we could be anal and check for a string.. meh
			if (SQ_REFRESH_ASSETIDS) {
				refreshAssets(SQ_REFRESH_ASSETIDS.split(/,|\|/));
				SQ_REFRESH_ASSETIDS = '';
			}

			// check again
			setTimeout(sq_assetMap.checkRefresh, sq_assetMap.params.refreshInterval);
		},

/*
		get_children: function get_children(xml_get, parent, $current_asset, replace) {
			// What do we add it to?
			var $target = $(sq_assetMap.selector);

			// are we replacing the contents?
			replace = replace || false;

			if (!parent) {
				// Construct our XML to send
				xml_get = sq_assetMap.util.getCommandXML('get assets', {}, [{
					assetid: $current_asset.attr('assetid'),
					start: 0,
					limit: sq_assetMap.params.fetchLimit,
					linkid: $current_asset.attr('linkid')
				}]);
			}

			// for removing the loading indicator
			var cls = 'loading' + String(Math.random()).replace(/\D/g, '');

			// Create our ajax to send the XML
			$.ajax({
				url: sq_assetMap.backend.getUrl(),
				type: 'POST',
				processData: false,
				data: xml_get,
				contentType: "text/xml",
				dataType: 'xml',
				error: function (XMLHttpRequest, textStatus, errorThrown) {
console.log(XMLHttpRequest, textStatus, errorThrown);
				},
				beforeSend: function () {
					$current_asset.children('a').append($('<img class="loading ' + cls + '" src="/dev/325.1.gif" width="12" height="12"></img>'));
				},
				success: function(xml) {
					// (re)build the list
					if (replace || !parent) {
						$target = $current_asset;
					}

					sq_assetMap._tree.buildBranch($target, $(xml));
//						$.each(sq_assetMap.trees, function(tree) {
//							// TODO the parsing of the XML should be here, not in each tree
//							tree.buildBranch.apply(tree, [$target, $(xml)]);
////							this.triggerHandler('nodeLoaded.assetMap', {$xml: $(xml)});
//						})
				},
				complete: function() {
					// Remove loading indicator
					$('.' + cls, $current_asset).remove();
				}
			});

		},
*/
		_locateAsset: function(info, callback) {
			var currentInfo = info.shift();

			// attempt to find the root node
			var $node = $('[assetid=' + currentInfo.assetid + '][sort_order=' + currentInfo.sort_order + ']', instances[0].get_container());

			if (!$node.length) {
console.log('cannot find node while locating asset', currentInfo, arguments);
return;
			}

			var tree = $.jstree._reference($node);
			tree.select_node($node);

			// TODO format this better
			if (info.length) {
				var cb = $.proxy(function() {
					this._locateAsset(info, callback);
				}, this);

				if ($node.attr('hasOpened') === 'true') {
					// just call open_node
					tree.open_node($node, cb);
				}
				else {
					// fetch the branch
					sq_tree.openBranch($node, cb);
				}
			}
		},

		locateAsset: function(info, callback) {
			this.jstree.deselect_all();

			// attempt to find the root node
//			var $node = $('[assetid=' + info[0].assetid + '][sort_order=' + info[0].sort_order + ']', this.get_container());
//			if (!$node.length) {
//console.log('cannot find node while locating asset', info[0], arguments);
//return;
//			}
//
//			// first deselect any selected nodes
//			var tree = $.jstree._reference($node);
//			tree.deselect_all();

			// now traverse through the info we've been given selecting
			// nodes on the way
			this._locateAsset(info, callback);
		}

	});

	if ($.squiz.matrix.debug) {
		console.log('assetMap', $.squiz.matrix.assetMap);
	}


	// some global bindings/option setting
	$(sq_ui)
		.bind('typesLoaded.squiz', function(event, data) {
console.log('ui handling types loaded');
			// Setup types for all maps
			$.extend(true, $.jstree.defaults, {
				types: data
			});
		});



// TODO this needs to work with a specific map?  or all maps?
// just the first one it seems
	$.fn.assetMapHandler = function() {
		return {
	//		target: $.fn.matrixMaps[0],
			jsToJavaCall: function jsToJavaCall(type, command, params_str) {
console.log('jsToJavaCall', arguments);
//console.log('with', this.target);
				switch (type) {
					case 'asset_locator':
						var infos = params_str.split("~");
						var assetIds = infos[0].split('|');
						var sortOrders = infos[1].split('|');

						infos = $.map(assetIds, function(v, i) {
							return {
								assetid: v,
								sort_order: sortOrders[i]
							};
						});

						sq_ui.locateAsset(infos);
						break;
					case 'asset_finder':
						switch (command) {
							case 'assetFinderStarted':
								var assetIds = params_str.split('~');
								$map.mode.change(sq_assetMap.mode.useme);
								break;
							case 'assetFinderStopped':
								$map.mode.change(sq_assetMap.mode.normal);
								break;
						}

						break;
				}
			},
			getMap: function() { return $map; }
		};
	}



//ERRORS occurring here when I picked up again
	return;

/*
	var tree = {
		// TODO modes belong here

		init: function(options) {
			var that = this;

			var defaults = {
				root: 1,
				showChildren: false,
				debug: true
			};

			that.options = $.extend(defaults, options);

			sq_assetMap.bind('typesLoaded.assetMap', $.proxy(function(event, data) {
				console.log('proxied', this, arguments);
			}, this));

			sq_assetMap
				.bind('typesLoaded.assetMap', function(event, data) {


// initialise the tree UI before receiving any events for it (ie, nodeLoaded.assetMap)
					that
						.bind("loaded.jstree", function (event, data) {
							// TODO reinstate this
		//					buildContextMenus();
		//					sq_assetMap._tree.buildBranch($(sq_assetMap.selector + ' [assetid=1]'), $(xml).find('assets'));
		//					buildBranch($(sq_assetMap.selector + ' [assetid=1]'), $(xml).find('assets'));
		//										$map.checkRefresh();

						})
						.jstree({
							plugins:[
								'json_data',
								'crrm',
								'ui',
								'themes',
								'dnd',
								'types'
							],
							core: {
								animation: 0
							},
							types: {
		//						types: sq_assetMap.assetTypes,
								type_attr: 'type_code'
							},
							themes: {
								theme: "classic",
								dots: false,
								icons: true
							},
							json_data: {
								data: [
									{
										data: 'root',
										state: 'closed',
										attr: {
											// TODO these may be different according to prefs/teleport
											assetid: 1,
											uniqueId: sq_assetMap._tree.model.uniqueId
										}
									}
								]
							},
							// see http://stackoverflow.com/questions/11000095/dnd-how-to-restrict-dropping-to-certain-node-types
							crrm: {
								move: {
									always_copy: "multitree", // false, true or "multitree"
									open_onmove: false,
									default_position: "last",
									check_move: function (m) {

										// we can check for valid parents here
										// potentially circumventing the "going to fail" hipo
		//								if(!m.np.hasClass("someClassInTarget")) return false;
		//								if(!m.o.hasClass("someClassInSource")) return false;
										return true;
									}
								}
							},
							dnd: {
								drag_finish: function(data) {
		console.log('drag_finish', arguments);
								},
								drop_finish: function(data) {
		console.log('drop_finish', arguments);
								}
							}
						})
						.bind("move_node.jstree", function(evt, data) {
		console.log('move_node event', arguments);
							var t = $.jstree._reference(this);
							// we'll handle opening ourselves so we can control
							// the refresh better
							data.rslt.np.parentsUntil(".jstree").andSelf().filter(".jstree-closed").each(function () {
								t.open_node(this, false, true);
							});
						})
						// this is in the context of the tree
						.bind('open_node.jstree', function(evt, data) {
							if (sq_assetMap.debug) console.log('open_node', arguments);

							// this is a lame way to get to the element
							// data.args[0] needs wrapping due to opening via dnd
							var $node = $(data.args[0]);

							if ($node.attr('assetid') === '1') return;
		console.log('checking for open');
							// check to see if we've already got our children
							// this is broken when we're asked to open via dnd
		//					if ($node.find('ul').length) return;

							$node.attr('hasOpened', true);

							// expand this branch
							get_children(null, false, data.args[0]);
						})
						// this is to detect when we've programmatically started
						// dnd, and we want to finish
						// see jstree:2434
						.bind('mousedown.sqtree', function(evt) {
							// this is too blunt - want to close branches while in dnd
							if($.vakata.dnd.is_drag && $.vakata.dnd.user_data.jstree) {
								$.vakata.dnd.drag_stop({});
								t.dnd_finish(evt);
							}
						});






				})
				.bind('init.assetMap', function(event, data) {
console.log('tree:init.assetMap', arguments);
					tree._init.call(that, data.$xml);
				})
//				.bind('nodeLoaded.assetMap', $.proxy(function(event, data) {
//console.log('tree:nodeloaded.assetMap', arguments);
////					$(this.selector).jstree('create', $root, data.info.attr['sort_order'] || 'inside', data.info, false, true);
//				}), this);
				.bind('nodeLoaded.assetMap', function(event, data) {
//console.log('tree:nodeloaded.assetMap', arguments);
//					$(this.selector).jstree('create', $root, data.info.attr['sort_order'] || 'inside', data.info, false, true);
//					$(that.selector).jstree('create', data.root, data.node.attr['sort_order'] || 'inside', data.node, false, true);
//console.log('adding node to ', that.selector);
//console.log('adding node to ', data.root.uniqueId);
//console.log('adding node to ', $('[uniqueId=' + data.root.uniqueId + ']', that.selector));
console.log('adding node', data.node);
					$(that.selector).jstree(
						'create',
						$('[uniqueId=' + data.root.uniqueId + ']', that.selector),
						data.node.attr['sort_order'] || 'inside',
						data.node,
						false,
						true
					);
				});

			// first tree?
			if (!sq_assetMap.trees.length) {
				sq_assetMap.initialise();
			}
			else {
				// TODO
			}

			// TODO can't use this here, there's only one of these
			sq_assetMap.trees.push(this);

			return this;
		},

		_init: function($xml) {
			var that = this;
			// Bind when user clicks icon to invoke a map mode
			$(document).on('click', that.selector + ' li.jstree-leaf', function(event) {
console.log(event);
console.log(that.selector + ' a > .jstree-icon', that.mode.current);

				var $target = $(event.target);
//				var $this = $(this);

				switch ($map.mode.current) {
					case sq_assetMap.mode.normal:
						if ($target.is('.jstree-icon') && $target.parent().is('a')) {
console.log('bingo, got an icon');
							event.preventDefault();
							event.stopImmediatePropagation();

							sq_assetMap.mode.change.call(this, sq_assetMap.mode.select);
							return false;
						}
						break;
					case sq_assetMap.mode.select:
						// need to do a programmatic drop
//						$.jstree._reference($map.selector).dnd_finish(event);
console.log('user_data', $.vakata.dnd.user_data);

						event.preventDefault();
						event.stopImmediatePropagation();

//						$map.mode.change.call(this, sq_assetMap.mode.normal);

						return false;
				}
			});

			// Remove selector if clicking escape
			$(document).keyup(function(event) {
//console.log(event);
				switch (event.keyCode) {
					case 27: // escape
						if (that.mode.current !== sq_assetMap.mode.select) return;
						sq_assetMap.mode.change.call(that, sq_assetMap.mode.normal);
					break;
					case 46: // delete
						if (that.mode.current !== sq_assetMap.mode.normal) {
console.log('cannot delete from mode', that.mode.current);
							return;
						}
						var t = $.jstree._reference(that.selector);
						if (!t.data.ui.selected.length) {
console.log('nothing selected', that.selected);
							return;
						}
						console.log('deleting', t.data.ui.selected);
					break;
				}
			});//end keyup


			// hook up menus
			var data = this.data();
			data['menuSelectors'] = {
				asset: this.selector + ' li[assetid] a'
			};

			$.contextMenu({
				selector: data.menuSelectors.asset,
				trigger: 'right',
				build: function($trigger, e) {
					var $asset = $trigger.parent('li[assetid]');
					var items = sq_assetMap.assetScreens[$asset.attr('type_code')];

					return {
						// requests for new children SHOULD BE handled automatically
						// we're just handling the first level of the menu (asset screens)
						callback: function(key, options) {
							var screenUrl = sq_assetMap.backend.getScreenUrl(key, $asset);

							sq_assetMap.util.changeMain(screenUrl);
						},
						items: items
					}
				}
			});


			data.menuSelectors['main'] = this.selector;
			$.contextMenu({
				selector: data.menuSelectors.main,
				trigger: 'right',
				callback: function(key, options) {
					console.log(arguments);

					// TODO this should go into a useme type state
					// and allow selecting the parent of the new asset
					// see MatrixTree.java:1332

					// create a new asset at the root
					// TODO work out where this asset is being added
//					sq_assetMap.backend.createAsset(key, 1, undefined);
					sq_assetMap.backend.createAsset(key, 1);
				},
				items: sq_assetMap.newMenuItems
			});










		},


	};




	$.fn.assetMapHandler = function() {
		return {
	//		target: $.fn.matrixMaps[0],
			jsToJavaCall: function jsToJavaCall(type, command, params_str) {
	//console.log('handling', arguments);
	//console.log('with', this.target);
				switch (type) {
					case 'asset_locator':
						var bits = params_str.split("~");
						var types = bits[0].split('|');
						var positions = bits[1].split('|');

console.log(arguments);
						break;
					case 'asset_finder':
						switch (command) {
							case 'assetFinderStarted':
								var types = params_str.split('~');
								$map.mode.change(sq_assetMap.mode.useme);
								break;
							case 'assetFinderStopped':
								$map.mode.change(sq_assetMap.mode.normal);
								break;
						}

						break;
				}
			},
			getMap: function() { return $map; }
		};
	}
*/
})(jQuery);

