from ultralytics import YOLO

# Load the pretrained model
model = YOLO("models/YOLOv8_Small_RDD.pt")

# Run detection on the test image
results = model("test_image.jpg")

# Print what it found
for result in results:
    boxes = result.boxes
    print(f"Detections found: {len(boxes)}")
    for box in boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        class_name = model.names[cls_id]
        print(f"  → {class_name} (confidence: {conf:.2f})")

# Save the image with boxes drawn on it, so you can see it visually
results[0].save(filename="test_output.jpg")
print("Saved result to test_output.jpg")