#target photoshop

app.displayDialogs = DialogModes.NO;

var srcFolder = Folder.selectDialog("请选择图片文件夹");

if (srcFolder == null) {
    alert("已取消");
} else {

    var templateFile = File.openDialog("请选择PSD模板");

    if (templateFile == null) {
        alert("已取消");
    } else {

        var outFolder = Folder.selectDialog("请选择输出文件夹");

        if (outFolder == null) {
            alert("已取消");
        } else {

            var rawFiles = srcFolder.getFiles();
            var files = [];
            var i;

            for (i = 0; i < rawFiles.length; i++) {
                if (rawFiles[i] instanceof File) {
                    var n = rawFiles[i].name.toLowerCase();
                    if (n.match(/\.(jpg|jpeg|png|tif|tiff|bmp)$/)) {
                        files.push(rawFiles[i]);
                    }
                }
            }

            files.sort(function(a, b) {
                return a.name > b.name ? 1 : -1;
            });

            if (files.length == 0) {
                alert("没有图片");
            } else if (files.length % 3 != 0) {
                alert("图片数量必须是3的倍数");
            } else {

                var docRef = app.open(templateFile);

                function getLayer(name) {
                    for (var k = 0; k < docRef.layers.length; k++) {
                        if (docRef.layers[k].name == name) return docRef.layers[k];
                    }
                    return null;
                }

                var leftLayer = getLayer("左画");
                var centerLayer = getLayer("中画");
                var rightLayer = getLayer("右画");

                if (!leftLayer || !centerLayer || !rightLayer) {
                    alert("PSD缺少 左画 中画 右画 图层");
                } else {

                    function replaceSO(layerRef, imgFile) {
                        try {
                            app.activeDocument = docRef;
                            docRef.activeLayer = layerRef;

                            executeAction(stringIDToTypeID("placedLayerEditContents"), undefined, DialogModes.NO);
                            var soDoc = app.activeDocument;

                            var innerSO = null;
                            for (var j = 0; j < soDoc.layers.length; j++) {
                                if (soDoc.layers[j].kind == LayerKind.SMARTOBJECT) {
                                    innerSO = soDoc.layers[j];
                                    break;
                                }
                            }

                            if (!innerSO) {
                                soDoc.close(SaveOptions.DONOTSAVECHANGES);
                                app.activeDocument = docRef;
                                return false;
                            }

                            soDoc.activeLayer = innerSO;
                            executeAction(stringIDToTypeID("placedLayerEditContents"), undefined, DialogModes.NO);

                            var innerDoc = app.activeDocument;

                            for (var t = innerDoc.layers.length - 1; t >= 0; t--) {
                                try {
                                    if (!innerDoc.layers[t].isBackgroundLayer) {
                                        innerDoc.layers[t].remove();
                                    }
                                } catch(err) {}
                            }

                            var desc = new ActionDescriptor();
                            desc.putPath(charIDToTypeID("null"), imgFile);
                            executeAction(stringIDToTypeID("placeEvent"), desc, DialogModes.NO);

                            var layer = innerDoc.activeLayer;
                            layer.rasterize(RasterizeType.ENTIRELAYER);

                            var docW = innerDoc.width.as("px");
                            var docH = innerDoc.height.as("px");

                            var bounds = layer.bounds;
                            var layerW = bounds[2].as("px") - bounds[0].as("px");
                            var layerH = bounds[3].as("px") - bounds[1].as("px");

                            var scale = Math.max(
                                (docW / layerW) * 100,
                                (docH / layerH) * 100
                            );

                            layer.resize(scale, scale, AnchorPosition.MIDDLECENTER);

                            bounds = layer.bounds;

                            layer.translate(
                                ((docW - (bounds[2].as("px") - bounds[0].as("px"))) / 2) - bounds[0].as("px"),
                                ((docH - (bounds[3].as("px") - bounds[1].as("px"))) / 2) - bounds[1].as("px")
                            );

                            innerDoc.save();
                            innerDoc.close(SaveOptions.SAVECHANGES);

                            soDoc.save();
                            soDoc.close(SaveOptions.SAVECHANGES);

                            app.activeDocument = docRef;
                            return true;

                        } catch(e) {

                            try {
                                app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
                            } catch(err) {}

                            app.activeDocument = docRef;
                            return false;
                        }
                    }

                    var jpgOpt = new JPEGSaveOptions();
                    jpgOpt.quality = 10;

                    var success = 0;

                    for (var g = 0; g < files.length; g += 3) {

                        if (
                            replaceSO(leftLayer, files[g]) &&
                            replaceSO(centerLayer, files[g + 1]) &&
                            replaceSO(rightLayer, files[g + 2])
                        ) {

                            // 获取第一个文件名的前两段
                            // 例如：BH-1-1.jpg → BH-1
                            var parts = files[g].name.split("-");
                            var baseName = parts[0] + "-" + parts[1];

                            // 输出文件名增加固定后缀 -1
                            var saveFile = new File(
                                outFolder.fsName + "/" + baseName + "-1.jpg"
                            );

                            docRef.saveAs(saveFile, jpgOpt, true);
                            success++;
                        }
                    }

                    docRef.close(SaveOptions.DONOTSAVECHANGES);

                    alert("完成\n成功：" + success + " 套");
                }
            }
        }
    }
}