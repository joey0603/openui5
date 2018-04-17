/*!
 * ${copyright}
 */

// Provides the default renderer for control sap.m.SliderTooltip
sap.ui.define(['jquery.sap.global', 'sap/ui/core/Renderer'],
	function (jQuery, Renderer) {
		"use strict";

		/**
		 * SliderTooltip renderer.
		 *
		 * @author SAP SE
		 * @namespace
		 */
		var SliderTooltipBaseRenderer = {};

		SliderTooltipBaseRenderer.CSS_CLASS = "sapMSliderTooltip";

		/**
		 * Renders the HTML for the given control, using the provided {@link sap.ui.core.RenderManager}.
		 *
		 * @param {sap.ui.core.RenderManager} oRM The RenderManager that can be used for writing to the renderer output buffer
		 * @param {sap.ui.core.Control} oControl An object representation of the control that should be rendered
		 */
		SliderTooltipBaseRenderer.render = function (oRM, oControl) {
			oRM.write("<div");
			oRM.writeControlData(oControl);
			oRM.writeClasses();

			oRM.write(">");

			this.renderTooltipContent(oRM, oControl);

			oRM.write("</div>");
		};

		/**
		 * Renders the internal content of the Tooltip.
		 * To be overwritten by subclasses.
		 *
		 * @param {sap.ui.core.RenderManager} oRM The RenderManager that can be used for writing to the render output buffer.
		 * @param {sap.ui.core.Control} oControl An object representation of the control that should be rendered.
		 */
		SliderTooltipBaseRenderer.renderTooltipContent = function (oRM, oControl) {};

		return SliderTooltipBaseRenderer;

	}, /* bExport= */ true);