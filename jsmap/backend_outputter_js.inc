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


require_once SQ_INCLUDE_PATH.'/backend_outputter.inc';


/**
* Backend_OutputterJS
*
* Purpose
*
*    Support the javascript asset map
*
* @author Andrew Sharpe <asharpe@squiz.com.au>
* @package MySource_Matrix
*/
class Backend_OutputterJS extends Backend_Outputter {

	/**
	 * Constructor
	 *
	 * @access  public
	 */
	function Backend_OutputterJS() {
		$this->Backend_Outputter();
	}


	/**
	 * Paint the header of the page
	 *
	 * This should only be used for the sq_sidenav frame
	 *
	 * @return void
	 * @access private
	 */
	function _paintHeader() {
		// add the requisite JS
		$this->addJSInclude('https://ajax.googleapis.com/ajax/libs/jquery/1.8.2/jquery.min.js');
		$this->addJSInclude(sq_web_path('lib') . '/jsmap/jquery.contextMenu.js');
		$this->addJSInclude(sq_web_path('lib') . '/jsmap/jquery.matrixTree.js');
		$this->addJSInclude(sq_web_path('lib') . '/jsmap/framesetup.js');
		$this->addJSInclude(sq_web_path('lib') . '/asset_map/asset_map.js');

		$this->addCssInclude(sq_web_path('lib') . '/jsmap/jquery.contextMenu.css');

		$this->addJSInclude(sq_web_path('root_url') . '/dev/jstree/jquery.jstree.js');

		// we're appending the name so it's easier to find out what frame is requesting the router
		$this->addOnLoad('jsRouterPath = "' . sq_web_path('lib') . '/jsmap/jsRouter.html?name=";');
		$this->addOnLoad('routerLoaded("sq_override");');
//		$this->addOnLoad('top.frames["sq_resizer"].location.href = jsRouterPath + "sq_resizer&src=backend_outputter_js";');
//		$this->addOnLoad('top.frames["sq_main"].location.href = jsRouterPath + "sq_main&src=backend_outputter_js";');

		$returnValue = parent::_paintHeader();

		?>
		<!-- allow capturing the router path -->
		<script type="text/javascript">
			var jsRouterPath;
		</script>
		<?php

		return $returnValue;
	}
}

