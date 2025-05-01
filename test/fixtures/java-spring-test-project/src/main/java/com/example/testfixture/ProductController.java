package com.example.testfixture;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    // PUT mapping
    @PutMapping("/{productId}")
    public ResponseEntity<String> updateProduct(@PathVariable Long productId, @RequestBody String productDetails) {
        // Simulate updating a product
        System.out.println("Updating product " + productId + " with details: " + productDetails);
        return ResponseEntity.ok("Product " + productId + " updated.");
    }

    // DELETE mapping
    @DeleteMapping("/{productId}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long productId) {
        // Simulate deleting a product
        System.out.println("Deleting product " + productId);
        return ResponseEntity.noContent().build();
    }

    // PATCH mapping
    @PatchMapping("/{productId}")
    public ResponseEntity<String> patchProduct(@PathVariable Long productId, @RequestBody Map<String, Object> updates) {
        // Simulate partially updating a product
        System.out.println("Patching product " + productId + " with updates: " + updates);
        return ResponseEntity.ok("Product " + productId + " patched.");
    }
}