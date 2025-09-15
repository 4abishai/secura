package com.secura.service;

import com.secura.entity.User;
import com.secura.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final ReactiveStringRedisTemplate redisTemplate;

    private static final String USER_KEY_PREFIX = "user:publicKey:";

    public Mono<String> getPublicKey(String username) {
        String redisKey = USER_KEY_PREFIX + username;

        return redisTemplate.opsForValue().get(redisKey)
                .switchIfEmpty(
                        userRepository.findByUsername(username)
                                .flatMap(user -> {
                                    String publicKey = user.getPublicKey();
                                    return redisTemplate.opsForValue()
                                            .set(redisKey, publicKey, Duration.ofMinutes(5))
                                            .thenReturn(publicKey);
                                })
                );
    }

    /**
     * Save user and invalidate Redis cache if public key changed.
     */
    public Mono<User> saveUser(User user, String newPublicKey) {
        String redisKey = USER_KEY_PREFIX + user.getUsername();

        boolean keyChanged = (newPublicKey != null && !newPublicKey.isBlank()
                && !newPublicKey.equals(user.getPublicKey()));

        if (keyChanged) {
            user.setPublicKey(newPublicKey);
        }

        return userRepository.save(user)
                .flatMap(savedUser -> {
                    if (keyChanged) {
                        return redisTemplate.opsForValue().delete(redisKey)
                                .thenReturn(savedUser);
                    }
                    return Mono.just(savedUser);
                });
    }
}
