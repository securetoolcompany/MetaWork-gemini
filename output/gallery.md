---
title: "Gallery"
slug: "gallery"
date: "
 2025-05-14 11:37:26 
"
type: "
 page 
"
excerpt: ""
---

<!-- wp:html --> <?php $base_dir = bloginfo('template_url'); // Get the theme's URL $media_dir = $base_dir . '/wp-content/uploads/lumise_data/images/'; // Path to your image folder (replace 'mypics' with your folder name) $files = glob($media_dir . '{*.jpg,*.png,*.gif}', GLOB_BRACE); // Get all image files (jpg, png, gif) if (count($files) > 0) { echo '<div class="image-gallery">'; // Start a div for styling foreach ($files as $image) { echo '<img src="' . $media_dir . basename($image) . '" alt="' . basename($image) . '">'; // Display each image } echo '</div>'; // End the div } ?> <!-- /wp:html -->
