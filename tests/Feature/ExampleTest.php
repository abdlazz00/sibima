<?php

it('sends a guest from the root to login without exposing framework versions', function () {
    $this->get('/')->assertRedirect('/dashboard');
    $this->get('/dashboard')->assertRedirect('/login');
});
