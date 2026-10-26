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

                // 对应截图中 PSD 的图层名
                var leftLayer = getLayer("左");
                var centerLayer = getLayer("中");
                var rightLayer = getLayer("右");

                if (!leftLayer || !centerLayer || !rightLayer) {
                    alert("PSD缺少 '左'、'中'、'右' 智能对象图层");
                } else {

                    // 单层智能对象替换函数
                    function replaceSO(layerRef, imgFile) {
                        try {
                            app.activeDocument = docRef;
                            docRef.activeLayer = layerRef;

                            // 打开智能对象内容
                            executeAction(stringIDToTypeID("placedLayerEditContents"), undefined, DialogModes.NO);
                            var soDoc = app.activeDocument;

                            // 清理旧图层
                            for (var t = soDoc.layers.length - 1; t >= 0; t--) {
                                try {
                                    if (!soDoc.layers[t].isBackgroundLayer) {
                                        soDoc.layers[t].remove();
                                    }
                                } catch(err) {}
                            }

                            // 置入新图片
                            var desc = new ActionDescriptor();
                            desc.putPath(charIDToTypeID("null"), imgFile);
                            executeAction(stringIDToTypeID("placeEvent"), desc, DialogModes.NO);

                            var layer = soDoc.activeLayer;
                            layer.rasterize(RasterizeType.ENTIRELAYER);

                            var docW = soDoc.width.as("px");
                            var docH = soDoc.height.as("px");

                            var bounds = layer.bounds;
                            var layerW = bounds[2].as("px") - bounds[0].as("px");
                            var layerH = bounds[3].as("px") - bounds[1].as("px");

                            // 等比缩放铺满智能对象画布
                            var scale = Math.max(
                                (docW / layerW) * 100,
                                (docH / layerH) * 100
                            );

                            layer.resize(scale, scale, AnchorPosition.MIDDLECENTER);

                            bounds = layer.bounds;

                            // 居中对齐
                            layer.translate(
                                ((docW - (bounds[2].as("px") - bounds[0].as("px"))) / 2) - bounds[0].as("px"),
                                ((docH - (bounds[3].as("px") - bounds[1].as("px"))) / 2) - bounds[1].as("px")
                            );

                            // 保存并关闭智能对象
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

                            // 提取文件前缀：如 BH-1-1.jpg -> BH-1
                            var parts = files[g].name.split("-");
                            var baseName = parts.length > 1 ? (parts[0] + "-" + parts[1]) : files[g].name.replace(/\.[^\.]+$/, "");

                            // 输出文件名加后缀 -1
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