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

		// TODO get this from somewhere else
		$this->addJSInclude('https://ajax.googleapis.com/ajax/libs/jquery/1.8.2/jquery.min.js');

		// TODO package these or get them from somewhere else
		$this->addJSInclude('/dev/jquery-ui-1.9.1.custom/js/jquery-ui-1.9.1.custom.js');
		$this->addCssInclude('/dev/jquery-ui-1.9.1.custom/css/ui-lightness/jquery-ui-1.9.1.custom.css');

		$this->addJSInclude(sq_web_path('lib') . '/jsmap/jquery-ui-1.9.1-resizable-sq.js');

		$this->addJSInclude(sq_web_path('lib') . '/jsmap/jquery.contextMenu.js');
		$this->addJSInclude(sq_web_path('lib') . '/jsmap/jquery.matrixTree.js');
		$this->addJSInclude(sq_web_path('lib') . '/jsmap/framesetup.js');
		$this->addJSInclude(sq_web_path('lib') . '/asset_map/asset_map.js');

		$this->addCssInclude(sq_web_path('lib') . '/jsmap/jquery.contextMenu.css');
		$this->addCssInclude(sq_web_path('lib') . '/jsmap/matrixTree.css');

		$this->addJSInclude(sq_web_path('root_url') . '/dev/jstree/jquery.jstree.js');

		// we're appending the name so it's easier to find out what frame is requesting the router
		$this->addOnLoad('jsRouterPath = "' . sq_web_path('lib') . '/jsmap/jsRouter.html?name=";');
//		$this->addOnLoad('routerLoaded("sq_override");');
		$this->addOnLoad('getItOn();');

		// see http://stackoverflow.com/questions/10091914/jstree-display-flaw-in-ie8
		// for the doctype
		?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<?php

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

