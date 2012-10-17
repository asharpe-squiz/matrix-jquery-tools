<?php
/**
* +--------------------------------------------------------------------+
* | This MySource Matrix CMS file is Copyright (c) Squiz Pty Ltd       |
* | ACN 084 670 600                                                    |
* +--------------------------------------------------------------------+
* | IMPORTANT: Your use of this Software is subject to the terms of    |
* | the Licence provided in the file licence.txt. If you cannot find   |
* | this file please contact Squiz (www.squiz.net) so we may provide   |
* | you a copy.                                                        |
* +--------------------------------------------------------------------+
*
* $Id: $
*
*/


require_once SQ_INCLUDE_PATH.'/backend.inc';


/**
 * Backend JS
 *
 * Purpose
 *
 *    Setup the javascript based asset map
 *
 * @author Andrew Sharpe <asharpe@squiz.com.au>
 * @package MySource_Matrix
 */
class BackendJS extends Backend {


	/**
	 * Constructor
	 *
	 */
	function BackendJS() {
		$this->Backend();
	}//end constructor


	/**
	 * Print out the frames page
	 *
	 * TODO refactor the parent class to make it more useful (ie, avoid copy/paste maintenance issue)
	 *
	 * @return void
	 * @access private
	 */
	function _printFrames() {
		$main_extras = '';
		if (!isset($_REQUEST['assetid'])) {
			$url_asset = $GLOBALS['SQ_SYSTEM']->am->getAssetFromURL(current_protocol(), NULL, TRUE, TRUE);
			if (!is_null($url_asset)) {
				$main_extras = '&assetid='.$url_asset->id.'&sq_from_frontend=1';
			}
		}

		$query_vars = Array();
		parse_str($_SERVER['QUERY_STRING'], $query_vars);
		if (!empty($query_vars)) {
			// At this point, SQ_BACKEND_PAGE shouldn't be overriden other than 'main' for
			// main frame URL. We can possibly have endlessly nested backend frames if the
			// value was set to be 'frames'
			if (isset($query_vars['SQ_BACKEND_PAGE'])) {
				unset($query_vars['SQ_BACKEND_PAGE']);
			}

			// append additional user defined query string
			// (e.g. for trigger condition 'url matches')
			foreach ($query_vars as $key => $value) {
				if ($key == 'SQ_ACTION') continue;
				$main_extras .= '&'.urlencode($key).'='.urlencode($value);
			}
		}

		$main_url = strip_url($_SERVER['PHP_SELF']).'?SQ_BACKEND_PAGE=main'.$main_extras;

		$frame_urls = Array(
						'header'	=> $_SERVER['PHP_SELF'].'?SQ_BACKEND_PAGE=header',
						'main'		=> $main_url,
						'sidenav'	=> $_SERVER['PHP_SELF'].'?SQ_BACKEND_PAGE=sidenav&jsmap=1',
						'resizer'	=> $_SERVER['PHP_SELF'].'?SQ_BACKEND_PAGE=resizer',
					  );
		$limbo_hipo = SQ_IN_LIMBO && (strpos($main_url, 'SQ_ACTION=hipo') !== FALSE);

		// Get the preference for whether or not to hide frames in Simple Edit
		$limbo_hide_frames = SQ_IN_LIMBO && $GLOBALS['SQ_SYSTEM']->getUserPrefs('user', 'SQ_USER_LIMBO_HIDE_FRAMES');

		// then, override the preference with the URL option
		if (isset($_GET['hide_frames'])) {
			$limbo_hide_frames = $limbo_hide_frames && $_GET['hide_frames'];
		}//end if

		// Give the page the appropriate title based on whether we are in limbo or backend
		if (SQ_IN_LIMBO) {
			$page_title = translate('page_title_simple_edit_interface', SQ_SYSTEM_LONG_NAME);
		} else {
			$page_title = translate('page_title_admin_interface', SQ_SYSTEM_LONG_NAME);
		}

		?>
		<html>
			<head>
				<title><?php echo $page_title; ?></title>
				<meta http-equiv="Content-Type" content="text/html; charset=<?php echo SQ_CONF_DEFAULT_CHARACTER_SET; ?>">
				<link rel="shortcut icon" href=<?php echo '"'.sq_web_path('lib').'/web/images/icons/favicon.ico"'; ?>/>
				<?php
				if ($limbo_hipo) {
					?>
					<script language="Javascript" type="text/javascript">
						document.location = "<?php echo $main_url; ?>";
					</script>
					<?php
				}
				?>
				<script type="text/javascript">
					// actual locations
					var frameUrls = {
						sq_header: '<?php echo $frame_urls['header']; ?>',
						sq_main: '<?php echo $frame_urls['main']; ?>',
						sq_sidenav: '<?php echo $frame_urls['sidenav']; ?>',
						sq_resizer: '<?php echo $frame_urls['resizer']; ?>'
					};

					// this is to make frame selection robust for existing code
					// there SHOULD BE a patch to matrix code to use this
					var getFrame = function getFrame(name) {
						switch (name) {
							case 'sq_header': return top.frames['sq_header'];
							case 'sq_sidenav': return top.frames['sq_sidenav'];
							case 'sq_resizer': return getFrame('sq_sidenav').frames['sq_resizer'];
							case 'sq_main': return getFrame('sq_sidenav').frames['sq_main'];
						}

						// this might not be sane!
						return top;
					}
				</script>
			</head>
			<?php
			if (!$limbo_hipo) {
				// if hide_frames is set, hide the header and remove the resizer
				// i.e. one less column in the second frameset
				// see _printMain() for more info
				$header_height = $limbo_hide_frames ? 0 : 28;
				$am_width = $GLOBALS['SQ_SYSTEM']->getUserPrefs('user', 'SQ_USER_ASSET_MAP_WIDTH');
				$sidenav_width = SQ_IN_LIMBO ? 0 : ($am_width+5);
				$resizer_width = $limbo_hide_frames ? 0 : 10;
				$frameset_cols = $sidenav_width.','.$resizer_width.',*';
				?>
				<frameset rows="<?php echo $header_height; ?>,*" frameborder="0" border="0" id="matrixFrameset">
					<!-- we have to load this after sq_sidenav so that hooking up the asset finder (via set_finder) works -->
					<frame src="about:blank" frameborder="0" name="sq_header" scrolling="no" marginwidth="0" marginheight="0">

					<!-- this is the business end -->
					<frame src="<?php echo $frame_urls['sidenav']; ?>" name="sq_sidenav" frameborder="0" scrolling="no" marginwidth="0" marginheight="0">

					<!-- these routers are loaded once sq_sidenav is ready -->
					<frame src="about:blank" frameborder="0" name="sq_resizer" scrolling="no" marginwidth="0" marginheight="0">
					<frame src="about:blank" frameborder="0" name="sq_main" scrolling="no" marginwidth="0" marginheight="0">

				</frameset>
				<?php
			}
			?>
		</html>
		<?php

	}//end _printFrames()


	/**
	 * Print out the Side Nav
	 *
	 * @return void
	 * @access private
	 */
	function _printSideNav()
	{
		$this->out->openRaw();
		$include_list = $GLOBALS['SQ_SYSTEM']->lm->getJavascriptIncludes();
		$include_list[] = sq_web_path('lib').'/js/general.js';
		foreach ($include_list as $link) {
			echo '<script type="text/javascript" src="'.$link.'"></script>'."\n";
		}
		?>
		<style type="text/css">
			body {
				background:	#342939;
				height: 100%;
			}

			.sidenav-tab-start {
				background:	url("<?php echo sq_web_path('lib'); ?>/web/images/sidenav_tab_start.png") no-repeat;
			}
			.sidenav-tab-start-active {
				background:	url("<?php echo sq_web_path('lib'); ?>/web/images/sidenav_active_tab_start.png") no-repeat;
			}
			.sidenav-tab, .sidenav-tab-icon {
				background:	url("<?php echo sq_web_path('lib'); ?>/web/images/sidenav_tab_bg.png");
			}
			.sidenav-tab-active, .sidenav-tab-icon-active {
				background:	url("<?php echo sq_web_path('lib'); ?>/web/images/sidenav_active_tab_bg.png");
			}
			.sidenav-tab-end {
				background:	url("<?php echo sq_web_path('lib'); ?>/web/images/sidenav_tab_end.png") no-repeat;
			}
			.sidenav-tab-end-active {
				background:	url("<?php echo sq_web_path('lib'); ?>/web/images/sidenav_active_tab_end.png") no-repeat;
			}

			.sidenav-tab-icon, .sidenav-tab-icon-active {
				padding-left:		5px;
			}

			.sidenav-tab a, .sidenav-tab-active a {
				font-family:		Arial;
				font-size:			10px;
				color:				#000000;
				padding-left:		2px;
				padding-right:		8px;
				text-decoration:	none;
			}

			#asset_map {
				margin:				0px;
				border:				1px solid #342939;
				padding:			0px;
				width:				100%;
			}

			#my_space {
				width:				100%;
				background-color:	#FFFFFF;
				padding:			0px;
				margin:				0px;
				border:				1px solid #FFFFFF;
			}
			.myspace-section {
				background-color:	#FFFFFF;
				border:				1px solid #A2A2A2;
				margin:				2px;
				width:				273px;
			}
			.myspace-section td, .myspace-section a {
				font-family:		Arial;
				font-size:			9px;
				color:				#666666;
				text-decoration:	none;
			}
			.myspace-section-header, .myspace-section-header a {
				font-size:			12px;
				font-weight:		bold;
				text-decoration:	none;
			}
		</style>
		<script type="text/javascript">
			var oldTabName = 'asset_map';
			var tabNames = Array('asset_map', 'my_space');

			function switchSideNav(tabName)
			{
				var tabElement = null;

				// show the correct DIV
				for (var i=0; i < tabNames.length; i++) {
					if (tabNames[i] != tabName) {
						tabElement = document.getElementById(tabNames[i]);
						tabElement.style.visibility = 'hidden';
					}
				}

				tabElement = document.getElementById(tabName);
				tabElement.style.visibility = 'visible';

				// switch the tabs
				var tabStart = document.getElementById(oldTabName + '_tab_start');
				tabStart.className = 'sidenav-tab-start';
				var tabEnd = document.getElementById(oldTabName + '_tab_end');
				tabEnd.className = 'sidenav-tab-end';
				var tabIcon = document.getElementById(oldTabName + '_tab_icon');
				tabIcon.className = 'sidenav-tab-icon';
				var tab = document.getElementById(oldTabName + '_tab');
				tab.className = 'sidenav-tab';

				tabStart = document.getElementById(tabName + '_tab_start');
				tabStart.className = 'sidenav-tab-start-active';
				tabEnd = document.getElementById(tabName + '_tab_end');
				tabEnd.className = 'sidenav-tab-end-active';
				tabIcon = document.getElementById(tabName + '_tab_icon');
				tabIcon.className = 'sidenav-tab-icon-active';
				tab = document.getElementById(tabName + '_tab');
				tab.className = 'sidenav-tab-active';

				// save this tab name for next time
				oldTabName = tabName;

			}//end switchSideNav()
		</script>

		<?php
		if (SQ_IN_LIMBO) {
			?>
				<table cellspacing="0" cellpadding="0" border="0" width="100%" height="100%">
					<tr>
						<td class="sq-backend-header-item" style="width: 100%;"><img style="margin-left: 21px; margin-bottom: 5px;" src="<?php echo sq_web_path('lib'); ?>/web/images/icons/asset_map/matrix_logo.gif" alt="MySource Matrix" /></td>
					</tr>
					<tr>
						<td height="100%" valign="top">&nbsp;</td>
					</tr>
					<tr>
						<td class="sq-backend-header-item" style="padding-bottom: 5px;">
							<a href="<?php echo SQ_SYSTEM_URL;?>" class="sq-backend-header-item" target="_blank" style="text-decoration:none;"><?php echo SQ_SYSTEM_LONG_NAME;?></a>
						</td>
					</tr>
				</table>
				<div id="asset_map" style="position: absolute; top: 27px; left: 6px; visibility: visible; border-top: 0px none; border-left: 0px none;">
					<?php
					require_once SQ_LIB_PATH.'/asset_map/asset_map.inc';
					$asset_map = new Asset_Map();
					$am_width = $GLOBALS['SQ_SYSTEM']->getUserPrefs('user', 'SQ_USER_ASSET_MAP_WIDTH');
					$asset_map->embedAssetMap('simple', $am_width);
					?>
				</div>
			<?php
		} else {
			// we are on the backend
			?>
				<table cellspacing="0" cellpadding="0" border="0" width="100%" height="100%">
					<tr>
						<td class="sq-backend-header-item" style="width: 100%;"><img style="margin-left: 21px; margin-bottom: 5px;" src="<?php echo sq_web_path('lib'); ?>/web/images/icons/asset_map/matrix_logo.gif" alt="MySource Matrix" /></td>
					</tr>
					<tr>
						<td height="100%" valign="top">
							<table cellspacing="0" cellpadding="0">
								<tr>
									<td><img src="<?php echo sq_web_path('lib'); ?>/web/images/blank.gif" width="24" height="1" /></td>

									<td class="sidenav-tab-start-active" id="asset_map_tab_start"><img src="<?php echo sq_web_path('lib'); ?>/web/images/blank.gif" width="2" height="20" /></td>
									<td class="sidenav-tab-icon-active" id="asset_map_tab_icon"><script language="JavaScript" type="text/javascript">sq_print_icon("<?php echo sq_web_path('lib'); ?>/web/images/icons/asset_map/tree.png", "14", "14", "");</script></td>
									<td class="sidenav-tab-active" id="asset_map_tab"><a href="#" onClick="Javascript: switchSideNav('asset_map'); return false;"><?php echo translate('asset_map'); ?></a></td>
									<td class="sidenav-tab-end-active" id="asset_map_tab_end"><img src="<?php echo sq_web_path('lib'); ?>/web/images/blank.gif" width="3" height="20" /></td>

									<td class="sidenav-tab-start" id="my_space_tab_start"><img src="<?php echo sq_web_path('lib'); ?>/web/images/blank.gif" width="2" height="20" /></td>
									<td class="sidenav-tab-icon" id="my_space_tab_icon"><script language="JavaScript" type="text/javascript">sq_print_icon("<?php echo sq_web_path('lib'); ?>/web/images/icons/asset_map/myspace.png", "14", "14", "");</script></td>
									<td class="sidenav-tab" id="my_space_tab"><a href="#" onClick="Javascript: switchSideNav('my_space'); return false;"><?php echo translate('my_space'); ?></a></td>
									<td class="sidenav-tab-end" id="my_space_tab_end"><img src="<?php echo sq_web_path('lib'); ?>/web/images/blank.gif" width="3" height="20" /></td>
								</tr>
							</table>
						</td>
					</tr>
					<tr>
						<td class="sq-backend-header-item" style="padding-bottom: 5px;">
							<a href="<?php echo SQ_SYSTEM_URL;?>" class="sq-backend-header-item" target="_blank" style="text-decoration:none;" <?php
								if (defined('SQ_LICENCE_INSTALL_KEY')) {
									echo ' title="Install Key: '.SQ_LICENCE_INSTALL_KEY.'"';
								}
							?>><?php echo SQ_SYSTEM_LONG_NAME;?></a>
						</td>
					</tr>
				</table>

				<div id="asset_map" style="position: absolute; top: 47px; left: 6px; visibility: visible; border-top: 0px none; border-left: 0px none; width: <?php echo $GLOBALS['SQ_SYSTEM']->getUserPrefs('user', 'SQ_USER_ASSET_MAP_WIDTH'); ?>px">
					<div id="jsmap"></div>
				</div>
				<div id="my_space" style="position: absolute; top: 44px; left: 0px; visibility: hidden;">
					<?php
					$user = $GLOBALS['SQ_SYSTEM']->user;
					$inbox_link = $GLOBALS['SQ_SYSTEM']->am->getLink($user->id, SQ_LINK_TYPE_2, 'inbox', TRUE, NULL, 'major', '1');

					if (empty($inbox_link)) {
						$inbox_url = '';
					} else {
						$inbox_asset = $GLOBALS['SQ_SYSTEM']->am->getAsset($inbox_link['minorid'], $inbox_link['minor_type_code']);
						$inbox_url       = $inbox_asset->getBackendHref('details');
						$new_message_url = $inbox_asset->getBackendHref('new_message');
						$sent_url        = $inbox_asset->getBackendHref('sent');
						$trash_url        = $inbox_asset->getBackendHref('trash');
					}

					$details_url = $user->getBackendHref('details');

					// get all unread messages and read messages that are less than 8 hours old
					if (!empty($inbox_url)) {
						$ms = $GLOBALS['SQ_SYSTEM']->getMessagingService();
						$from = time() - 28800; // 8 hours ago
						$read_messages   = $ms->getMessages($GLOBALS['SQ_SYSTEM']->currentUserId(), NULL, Array(SQ_MSG_READ), Array(), $from, NULL, 'short_name', Array(), 0, TRUE);
						$unread_messages = $ms->getMessages($GLOBALS['SQ_SYSTEM']->currentUserId(), NULL, Array(SQ_MSG_UNREAD), Array(), NULL, NULL, 'short_name', Array(), 0, TRUE);

						$messages = $read_messages + $unread_messages;
						?>
						<table class="myspace-section">
							<tr>
								<td valign="top"><a href="<?php echo $_SERVER['PHP_SELF'].$inbox_url; ?>" target="sq_main"><img src="<?php echo sq_web_path('lib'); ?>/web/images/icons/asset_map/inbox_icon.png" align="left" border="0" /></a></td>
								<td width="100%">
									<p><a href="<?php echo $_SERVER['PHP_SELF'].$inbox_url; ?>" target="sq_main"><span class="myspace-section-header"><?php echo translate('my_inbox'); ?></span><br /><span id="sq_messages_text"><?php echo translate('inbox_new_messages', $unread_messages, $messages); ?></span></a></p>
									<p><a href="<?php echo $_SERVER['PHP_SELF'].$inbox_url; ?>" target="sq_main"><span class="myspace-section-header"><?php echo translate('inbox_actions'); ?></span><br />
									<a href="<?php echo $_SERVER['PHP_SELF'].$inbox_url; ?>" target="sq_main">+ <?php echo translate('inbox_view'); ?></a><br />
									<a href="<?php echo $_SERVER['PHP_SELF'].$new_message_url; ?>" target="sq_main">+ <?php echo translate('inbox_send'); ?></a><br />
									<a href="<?php echo $_SERVER['PHP_SELF'].$sent_url; ?>" target="sq_main">+ <?php echo translate('inbox_view_sent'); ?></a><br />
									<a href="<?php echo $_SERVER['PHP_SELF'].$trash_url; ?>" target="sq_main">+ <?php echo translate('inbox_view_trash'); ?></a></p>
								</td>
							</tr>
						</table>
						<?php
					}//end if user has an inbox

					?>
					<table class="myspace-section">
						<tr>
							<td valign="top"><a href="<?php echo $_SERVER['PHP_SELF'].$details_url; ?>" target="sq_main"><img src="<?php echo sq_web_path('lib'); ?>/web/images/icons/asset_map/mydetails_icon.png" align="left" border="0" /></a></td>
							<td width="100%">
								<span class="myspace-section-header"><a href="<?php echo $_SERVER['PHP_SELF'].$details_url; ?>" target="sq_main"><?php echo translate('my_details'); ?></span><br /><?php echo translate('details_edit'); ?></a>
							</td>
						</tr>
					</table>
				</div>

				<!-- hidden iframe to route calls to the left nav -->
				<iframe src="<?php echo sq_web_path('lib') . '/jsmap/jsRouter.html'; ?>?name=sq_sidenav&src=backend_js" name="sq_sidenav" border="0" scrolling="no" marginwidth="0" marginheight="0" style="display:none"></iframe>

				<iframe src="about:blank" name="sq_resizer" border="0" width="10" scrolling="no" marginwidth="0" marginheight="0" style="position:absolute;left:280;top:0;border:0;height:100%"></iframe>
				<!-- this frame refers to itself to set the asset finder, see core/lib/html_form/html_form.inc:829 -->
				<iframe src="about:blank" name="sq_main" border="0" marginwidth="0" marginheight="0" scrolling="auto" style="position:absolute;border:0;height:100%;width:60%;right:0;top:0"></iframe>

				<!-- hidden iframe to satisfy requirement for header frame. see backend.inc:1499 -->
				<!-- TODO intercept calls to this frame and redirect them (if any) -->
				<iframe src="<?php echo sq_web_path('lib') . '/jsmap/jsRouter.html'; ?>?name=sq_header&src=backend_js" name="sq_header" border="0" scrolling="no" marginwidth="0" marginheight="0" style="display:none"></iframe>

				<script type="text/javascript">
					$(function() {
						mapWidth = $('#asset_map').get(0).offsetWidth;

						// tidy up positioning and widths
						$('iframe[name="sq_resizer"]')
							.css({
								top: 0,
								left: mapWidth
							});
						$('iframe[name="sq_main"]')
							.css({
								top: 0,
								right: 0,
								width: document.body.offsetWidth - (mapWidth + 10)
							});
					});

					var mapNegativeOffset = <?php echo SQ_IN_LIMBO ? 51 : 70; ?>;
				</script>
			<?php
		}//end else if not in limbo

		$this->out->closeRaw();

	}//end _printSideNav()


	/**
	 * Print out the Side Nav
	 *
	 * @return void
	 * @access private
	 */
/*
// Instead of changing this, we'll just override the toggleFrame method
	function _printNavResizer()
	{
		$this->out->openRaw();

		?>
		<style>
			body {
				background: #342939;
				height: 100%;
			}
		</style>

		<script language="Javascript" type="text/javascript">
			var clickSize = 50;
			var fset = top.document.getElementById('main_frameset');
			hidden = <?php var_export(SQ_IN_LIMBO); ?>;
			<?php $am_width = $GLOBALS['SQ_SYSTEM']->getUserPrefs('user', 'SQ_USER_ASSET_MAP_WIDTH') + 5; ?>

			function toggleFrame() {
				if (hidden == false) {
					if (fset.cols == "<?php echo $am_width; ?>,10,*") {
						fset.cols = "0,10,*";
					} else if (fset.cols == "<?php echo $am_width; ?>,0,*") {
						fset.cols = "0,0,*";
					}
					hidden = true;
				} else {
					if (fset.cols == "0,10,*") {
						fset.cols = "<?php echo $am_width; ?>,10,*";
					} else if (fset.cols == "0,0,*") {
						fset.cols = "<?php echo $am_width; ?>,0,*";
					}
					hidden = false;
				}
			}
		</script>

		<table border="0" cellspacing="0" cellpadding="0" width="100%" height="100%" background="<?php echo $this->out->filesPath('/images/flash_resizer/background.gif'); ?>">
			<tr>
				<td valign="top"><img src="<?php echo $this->out->filesPath('/images/flash_resizer/top.gif'); ?>" width="9" height="25" border="0" alt="" /></td>
			</tr>
			<tr height="100%">
				<td valign="middle"><a class="sq-backend-header-item" style="padding: 0px;" href="#" onClick="Javascript: toggleFrame()"><img src="<?php echo $this->out->filesPath('/images/flash_resizer/bar.gif'); ?>" width="9" height="72" border="0" alt="<<" /></a></td>
			</tr>
		</table>

		<script language="Javascript" type="text/javascript">
			document.main_form.style.width = "100%";
			document.main_form.style.height = "100%";
		</script>
		<?php

		$this->out->closeRaw();

	}//end _printNavResizer()
*/



}

