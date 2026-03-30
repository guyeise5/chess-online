<?php

$config = array(

    'admin' => array(
        'core:AdminPassword',
    ),

    'example-userpass' => array(
        'exampleauth:UserPass',
        'user1:user1pass' => array(
            'uid' => array('1'),
            'cn' => array('Alice'),
            'sn' => array('Smith'),
            'eduPersonAffiliation' => array('group1'),
            'email' => 'user1@example.com',
        ),
        'user2:user2pass' => array(
            'uid' => array('2'),
            'cn' => array('Bob'),
            'sn' => array('Jones'),
            'eduPersonAffiliation' => array('group2'),
            'email' => 'user2@example.com',
        ),
        'user3:user3pass' => array(
            'uid' => array('3'),
            'cn' => array('Charlie'),
            'sn' => array('Brown'),
            'eduPersonAffiliation' => array('group1'),
            'email' => 'user3@example.com',
        ),
    ),

);
