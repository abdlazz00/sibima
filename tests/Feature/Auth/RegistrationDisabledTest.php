<?php

it('does not expose public registration routes', function () {
    $this->get('/register')->assertNotFound();

    $this->post('/register', [
        'name' => 'Hacker',
        'email' => 'hacker@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertNotFound();
});
